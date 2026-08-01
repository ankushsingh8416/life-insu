import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { createHash, randomUUID } from "crypto";
import { QUEUE_NAMES } from "../../queue/queue.constants";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import { QdrantService } from "../../rag/qdrant.service";
import { EmbeddingService } from "../../rag/embedding.service";
import { ContentExtractorService } from "../extractors/content-extractor.service";
import { ChunkingService } from "../chunking.service";

interface IngestionJobData {
  documentId: string;
}

const EMBEDDING_BATCH_SIZE = 64;

@Processor(QUEUE_NAMES.KNOWLEDGE_INGESTION, { concurrency: 3 })
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly qdrantService: QdrantService,
    private readonly embeddingService: EmbeddingService,
    private readonly extractorService: ContentExtractorService,
    private readonly chunkingService: ChunkingService,
  ) {
    super();
  }

  async process(job: Job<IngestionJobData>): Promise<void> {
    const { documentId } = job.data;
    const document = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!document) {
      this.logger.warn(`Document ${documentId} no longer exists, skipping job`);
      return;
    }

    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "processing", failureReason: null },
    });

    try {
      const extracted = await this.extractContent(document);
      const checksum = createHash("sha256").update(extracted.text).digest("hex");

      // Crawler re-visits pages whether or not they actually changed. If the
      // extracted content is byte-for-byte identical to what's already indexed,
      // skip the expensive chunk/embed/upsert work entirely — just bump
      // lastCrawledAt so the crawl log reflects that the page was checked.
      if (document.status === "indexed" && document.checksum === checksum) {
        await this.prisma.knowledgeDocument.update({
          where: { id: documentId },
          data: { lastCrawledAt: new Date() },
        });
        this.logger.log(`Document ${documentId} unchanged (checksum match) — skipped re-indexing`);
        return;
      }

      const chunks = this.chunkingService.chunk(extracted.text);

      if (chunks.length === 0) {
        throw new Error("No extractable text content found in source");
      }

      // Re-indexing: wipe previous vectors/rows for this document first.
      await this.qdrantService.deleteByDocumentId(documentId);
      await this.prisma.knowledgeChunk.deleteMany({ where: { documentId } });

      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const vectors = await this.embeddingService.embedBatch(batch.map((c) => c.content));
        if (vectors.length !== batch.length) {
          throw new Error("Embedding provider returned a mismatched number of vectors");
        }

        const points = batch.map((chunk, idx) => ({
          id: randomUUID(),
          chunk,
          vector: vectors[idx] as number[],
          payload: {
            documentId,
            chunkId: "", // filled below after we know the DB id
            documentTitle: extracted.title,
            sourceUrl: document.sourceUrl,
            sourceType: document.sourceType,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
          },
        }));

        const dbChunks = await this.prisma.$transaction(
          points.map((p) =>
            this.prisma.knowledgeChunk.create({
              data: {
                id: p.id,
                documentId,
                content: p.chunk.content,
                chunkIndex: p.chunk.chunkIndex,
                tokenCount: p.chunk.tokenCount,
                qdrantPointId: p.id,
              },
            }),
          ),
        );

        points.forEach((p, idx) => {
          p.payload.chunkId = dbChunks[idx]!.id;
        });

        await this.qdrantService.upsertChunks(points);
      }

      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: "indexed",
          title: extracted.title || document.title,
          chunkCount: chunks.length,
          checksum,
          lastCrawledAt: new Date(),
        },
      });

      this.logger.log(`Indexed document ${documentId} (${chunks.length} chunks)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ingestion failed for document ${documentId}: ${message}`);
      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "failed", failureReason: message },
      });
      throw error;
    }
  }

  private async extractContent(document: {
    sourceType: string;
    sourceUrl: string | null;
    s3Key: string | null;
    title: string;
  }): Promise<{ title: string; text: string }> {
    if (document.sourceType === "url" || document.sourceType === "website" || document.sourceType === "irdai") {
      if (!document.sourceUrl) throw new Error("Document is missing sourceUrl");
      return this.extractorService.extractFromUrl(document.sourceUrl);
    }

    if (!document.s3Key) throw new Error("Document is missing s3Key");
    const buffer = await this.storageService.getObjectBuffer(document.s3Key);
    const mimeType =
      document.sourceType === "pdf"
        ? "application/pdf"
        : document.sourceType === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : document.sourceType === "csv"
            ? "text/csv"
            : "text/plain";

    return this.extractorService.extractFromFile(buffer, mimeType, document.title);
  }
}

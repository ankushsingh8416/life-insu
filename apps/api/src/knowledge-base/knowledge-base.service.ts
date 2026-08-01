import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  CreateKnowledgeUrlRequest,
  KnowledgeDocument,
  KnowledgeSourceType,
  ListKnowledgeDocumentsQuery,
  PaginatedResult,
} from "@sabsepehle/shared-types";
import { PrismaService } from "../common/prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { QdrantService } from "../rag/qdrant.service";
import { QUEUE_NAMES } from "../queue/queue.constants";

const MIME_TO_SOURCE_TYPE: Record<string, KnowledgeSourceType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/csv": "csv",
};

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly qdrantService: QdrantService,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_INGESTION) private readonly ingestionQueue: Queue,
  ) {}

  async createFromUpload(file: Express.Multer.File): Promise<KnowledgeDocument> {
    const sourceType = MIME_TO_SOURCE_TYPE[file.mimetype];
    if (!sourceType) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const { key } = await this.storageService.uploadFile(file.buffer, file.originalname, file.mimetype);

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        title: file.originalname,
        sourceType,
        s3Key: key,
        status: "pending",
      },
    });

    await this.enqueueIngestion(doc.id);
    return toDto(doc);
  }

  async createFromUrl(dto: CreateKnowledgeUrlRequest): Promise<KnowledgeDocument> {
    const existing = await this.prisma.knowledgeDocument.findUnique({
      where: { sourceUrl: dto.url },
    });

    const doc = existing
      ? await this.prisma.knowledgeDocument.update({
          where: { id: existing.id },
          data: { status: "pending", title: dto.title ?? existing.title },
        })
      : await this.prisma.knowledgeDocument.create({
          data: {
            title: dto.title ?? dto.url,
            sourceType: dto.sourceType,
            sourceUrl: dto.url,
            status: "pending",
          },
        });

    await this.enqueueIngestion(doc.id);
    return toDto(doc);
  }

  async list(query: ListKnowledgeDocumentsQuery): Promise<PaginatedResult<KnowledgeDocument>> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.knowledgeDocument.count({ where }),
    ]);

    return {
      items: items.map(toDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getById(id: string): Promise<KnowledgeDocument> {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Knowledge document ${id} not found`);
    return toDto(doc);
  }

  async remove(id: string): Promise<void> {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Knowledge document ${id} not found`);

    await this.qdrantService.deleteByDocumentId(id);
    if (doc.s3Key) {
      await this.storageService.deleteObject(doc.s3Key).catch((err) =>
        this.logger.warn(`Failed to delete S3 object ${doc.s3Key}: ${err}`),
      );
    }
    await this.prisma.knowledgeDocument.delete({ where: { id } });
  }

  async reindex(id: string): Promise<KnowledgeDocument> {
    const doc = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: { status: "pending" },
    });
    await this.enqueueIngestion(id);
    return toDto(doc);
  }

  private async enqueueIngestion(documentId: string): Promise<void> {
    await this.ingestionQueue.add(
      "ingest",
      { documentId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 100, removeOnFail: 500 },
    );
  }
}

function toDto(doc: {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  s3Key: string | null;
  status: string;
  chunkCount: number;
  checksum: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeDocument {
  return {
    id: doc.id,
    title: doc.title,
    sourceType: doc.sourceType as KnowledgeDocument["sourceType"],
    sourceUrl: doc.sourceUrl,
    s3Key: doc.s3Key,
    status: doc.status as KnowledgeDocument["status"],
    chunkCount: doc.chunkCount,
    checksum: doc.checksum,
    failureReason: doc.failureReason,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

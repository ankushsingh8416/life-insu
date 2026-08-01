import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QdrantClient } from "@qdrant/js-client-rest";
import { AppConfig } from "../common/config/configuration";
import { EmbeddingService } from "./embedding.service";

export interface QdrantPointPayload {
  documentId: string;
  chunkId: string;
  documentTitle: string;
  sourceUrl: string | null;
  sourceType: string;
  content: string;
  chunkIndex: number;
}

export interface QdrantSearchHit {
  score: number;
  payload: QdrantPointPayload;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client!: QdrantClient;
  private collection!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async onModuleInit() {
    const { qdrant } = this.config.get<AppConfig>("app")!;
    this.collection = qdrant.collection;
    this.client = new QdrantClient({
      url: qdrant.url,
      apiKey: qdrant.apiKey || undefined,
    });
    await this.ensureCollection();
  }

  private async ensureCollection(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === this.collection);
    if (exists) return;

    await this.client.createCollection(this.collection, {
      vectors: { size: this.embeddingService.dimensions, distance: "Cosine" },
      hnsw_config: { m: 16, ef_construct: 128 },
      optimizers_config: { default_segment_number: 2 },
    });

    await this.client.createPayloadIndex(this.collection, {
      field_name: "documentId",
      field_schema: "keyword",
    });
    await this.client.createPayloadIndex(this.collection, {
      field_name: "sourceType",
      field_schema: "keyword",
    });

    this.logger.log(`Created Qdrant collection "${this.collection}"`);
  }

  async upsertChunks(
    points: { id: string; vector: number[]; payload: QdrantPointPayload }[],
  ): Promise<void> {
    if (points.length === 0) return;
    await this.client.upsert(this.collection, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload as unknown as Record<string, unknown>,
      })),
    });
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.client.delete(this.collection, {
      wait: true,
      filter: { must: [{ key: "documentId", match: { value: documentId } }] },
    });
  }

  async search(
    vector: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<QdrantSearchHit[]> {
    const result = await this.client.search(this.collection, {
      vector,
      limit: topK,
      with_payload: true,
      filter,
    });

    return result.map((point) => ({
      score: point.score,
      payload: point.payload as unknown as QdrantPointPayload,
    }));
  }
}

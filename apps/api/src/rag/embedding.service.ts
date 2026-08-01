import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { AppConfig } from "../common/config/configuration";

/**
 * The entire knowledge base is embedded in ONE fixed vector space so that
 * switching the chat completion provider (AiOrchestratorService) can never
 * desync stored vectors from query vectors. This is intentionally NOT part
 * of the swappable AiProvider interface.
 */
@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private client!: OpenAI;
  private model!: string;
  readonly dimensions = 3072; // text-embedding-3-large

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const { openai } = this.config.get<AppConfig>("app")!.ai;
    this.model = openai.embeddingModel;
    this.client = new OpenAI({ apiKey: openai.apiKey });
    if (!openai.apiKey) {
      this.logger.warn("OPENAI_API_KEY not set — embedding generation will fail");
    }
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    if (!vector) throw new Error("Embedding provider returned no vector");
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}

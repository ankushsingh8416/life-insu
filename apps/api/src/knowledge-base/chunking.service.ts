import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../common/config/configuration";

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

@Injectable()
export class ChunkingService {
  constructor(private readonly config: ConfigService) {}

  /** Splits cleaned text into overlapping, sentence-aware chunks sized for embedding. */
  chunk(text: string): TextChunk[] {
    const { rag } = this.config.get<AppConfig>("app")!;
    const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
    if (!normalized) return [];

    const sentences = normalized.split(/(?<=[.!?।])\s+/);
    const chunks: TextChunk[] = [];
    let current = "";
    let chunkIndex = 0;

    const pushCurrent = () => {
      const trimmed = current.trim();
      if (trimmed) {
        chunks.push({ content: trimmed, chunkIndex: chunkIndex++, tokenCount: estimateTokens(trimmed) });
      }
    };

    for (const sentence of sentences) {
      if ((current + " " + sentence).length > rag.chunkSize && current.length > 0) {
        pushCurrent();
        const overlapText = current.slice(-rag.chunkOverlap);
        current = overlapText + " " + sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    pushCurrent();

    return chunks;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Citation } from "@sabsepehle/shared-types";
import { AppConfig } from "../common/config/configuration";
import { EmbeddingService } from "./embedding.service";
import { QdrantService, QdrantSearchHit } from "./qdrant.service";

export interface RetrievedContext {
  citations: Citation[];
  contextBlocks: string[];
  topScore: number;
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly config: ConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantService: QdrantService,
  ) {}

  async retrieve(query: string): Promise<RetrievedContext> {
    const { rag } = this.config.get<AppConfig>("app")!;
    const vector = await this.embeddingService.embed(query);
    const hits = await this.qdrantService.search(vector, rag.topK);

    const ranked = this.hybridRerank(query, hits);
    const relevant = ranked.filter((hit) => hit.score >= rag.minSimilarity);

    const citations: Citation[] = relevant.map((hit) => ({
      documentId: hit.payload.documentId,
      chunkId: hit.payload.chunkId,
      title: hit.payload.documentTitle,
      sourceUrl: hit.payload.sourceUrl,
      snippet: truncate(hit.payload.content, 280),
      score: Math.round(hit.score * 1000) / 1000,
    }));

    const contextBlocks = relevant.map(
      (hit, i) =>
        `[Source ${i + 1}: ${hit.payload.documentTitle}]\n${hit.payload.content}`,
    );

    return {
      citations,
      contextBlocks,
      topScore: ranked[0]?.score ?? 0,
    };
  }

  /**
   * Lightweight hybrid re-rank: blends dense vector similarity (from Qdrant)
   * with a sparse keyword-overlap signal so exact terms (policy numbers,
   * product names, IRDAI section numbers) aren't lost to pure semantic drift.
   * A full sparse-vector (BM25) fusion in Qdrant is a documented Phase 2
   * upgrade — see docs/architecture.md.
   */
  private hybridRerank(query: string, hits: QdrantSearchHit[]): QdrantSearchHit[] {
    const queryTerms = tokenize(query);
    if (queryTerms.size === 0) return hits;

    return [...hits]
      .map((hit) => {
        const contentTerms = tokenize(hit.payload.content);
        const overlap = [...queryTerms].filter((t) => contentTerms.has(t)).length;
        const keywordBoost = Math.min(overlap / Math.max(queryTerms.size, 1), 1) * 0.08;
        return { ...hit, score: Math.min(hit.score + keywordBoost, 1) };
      })
      .sort((a, b) => b.score - a.score);
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}...`;
}

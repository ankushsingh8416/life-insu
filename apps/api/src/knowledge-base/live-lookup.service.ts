import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { Citation } from "@sabsepehle/shared-types";
import { AppConfig } from "../common/config/configuration";
import { isRecencyContentQuery } from "../rag/guardrail.service";
import { ContentExtractorService } from "./extractors/content-extractor.service";
import { SitemapService, SitemapEntry } from "./sitemap.service";
import { KnowledgeBaseService } from "./knowledge-base.service";

const MAX_CANDIDATES = 2;
const MAX_LIVE_CONTEXT_CHARS = 4000;

export interface LiveLookupResult {
  contextBlocks: string[];
  citations: Citation[];
}

/**
 * Last-resort fallback for questions the indexed knowledge base has nothing
 * relevant for: fetch the live site directly instead of just declining.
 *
 * Deliberately narrow in scope — it only ever looks at the company's own
 * sitemap/pages (never the open web), so it can't be steered into fetching
 * arbitrary attacker-supplied URLs or introducing unrelated content. Anything
 * it finds gets quietly queued for permanent ingestion, so the same question
 * hits the real vector-indexed knowledge base next time instead of needing
 * another live fetch.
 */
@Injectable()
export class LiveLookupService {
  private readonly logger = new Logger(LiveLookupService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sitemapService: SitemapService,
    private readonly extractorService: ContentExtractorService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {}

  async attemptLiveLookup(query: string): Promise<LiveLookupResult | null> {
    const { crawler } = this.config.get<AppConfig>("app")!;

    let entries: SitemapEntry[];
    try {
      entries = await this.sitemapService.fetchSitemapUrls(crawler.companyWebsiteBaseUrl);
    } catch (error) {
      this.logger.warn(`Live lookup: sitemap fetch failed: ${error}`);
      return null;
    }

    const candidates = this.selectCandidates(query, entries);
    if (candidates.length === 0) return null;

    const contextBlocks: string[] = [];
    const citations: Citation[] = [];

    for (const candidate of candidates) {
      try {
        const extracted = await this.extractorService.extractFromUrl(candidate.url);
        if (!extracted.text || extracted.text.trim().length < 50) continue;

        const snippet = extracted.text.slice(0, MAX_LIVE_CONTEXT_CHARS);
        contextBlocks.push(`[Live source: ${extracted.title}]\n${snippet}`);
        citations.push({
          documentId: randomUUID(),
          chunkId: randomUUID(),
          title: extracted.title,
          sourceUrl: candidate.url,
          snippet: snippet.slice(0, 280),
          score: 0.5, // nominal — not a vector similarity score, just marks "live, not pre-indexed"
        });

        // Fire-and-forget: permanently index this page so the same question is
        // answered from the real knowledge base next time.
        this.knowledgeBaseService
          .createFromUrl({ url: candidate.url, sourceType: "website" })
          .catch((error) => this.logger.warn(`Background ingestion of ${candidate.url} failed: ${error}`));
      } catch (error) {
        this.logger.warn(`Live fetch failed for ${candidate.url}: ${error}`);
      }
    }

    return contextBlocks.length > 0 ? { contextBlocks, citations } : null;
  }

  private selectCandidates(query: string, entries: SitemapEntry[]): SitemapEntry[] {
    const normalized = query.toLowerCase();

    // "what's your latest blog post" etc — recency beats keyword overlap since
    // there's no keyword to match against a specific slug.
    if (isRecencyContentQuery(normalized)) {
      return [...entries]
        .filter((e) => e.lastmod && /\/learn\//.test(e.url))
        .sort((a, b) => new Date(b.lastmod!).getTime() - new Date(a.lastmod!).getTime())
        .slice(0, MAX_CANDIDATES);
    }

    const queryTerms = tokenize(normalized);
    if (queryTerms.size === 0) return [];

    const scored = entries
      .map((entry) => {
        const slugTerms = tokenize(entry.url.replace(/^https?:\/\/[^/]+/, "").replace(/[-/_]/g, " "));
        const overlap = [...queryTerms].filter((t) => slugTerms.has(t)).length;
        return { entry, overlap };
      })
      .filter((s) => s.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap);

    return scored.slice(0, MAX_CANDIDATES).map((s) => s.entry);
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

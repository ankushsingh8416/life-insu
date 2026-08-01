import { Injectable, Logger } from "@nestjs/common";
import * as cheerio from "cheerio";
import { RedisService } from "../common/redis/redis.service";

export interface SitemapEntry {
  url: string;
  lastmod?: string;
}

const SITEMAP_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);

  constructor(private readonly redis: RedisService) {}

  /** Fetches and parses /sitemap.xml, caching the result briefly so repeated
   * lookups (crawler runs, live-lookup fallback) don't hammer the target site. */
  async fetchSitemapUrls(baseUrl: string): Promise<SitemapEntry[]> {
    const cacheKey = `sitemap:${baseUrl}`;
    const cached = await this.redis.get<SitemapEntry[]>(cacheKey);
    if (cached) return cached;

    const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();
    const response = await fetch(sitemapUrl, {
      headers: { "User-Agent": "SabsePehleAI-KnowledgeCrawler/1.0" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap ${sitemapUrl}: HTTP ${response.status}`);
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const entries: SitemapEntry[] = [];

    $("url").each((_, el) => {
      const loc = $(el).find("loc").first().text().trim();
      const lastmod = $(el).find("lastmod").first().text().trim() || undefined;
      if (loc) entries.push({ url: loc, lastmod });
    });

    await this.redis.set(cacheKey, entries, SITEMAP_CACHE_TTL_SECONDS).catch((error) => {
      this.logger.warn(`Failed to cache sitemap for ${baseUrl}: ${error}`);
    });

    return entries;
  }
}

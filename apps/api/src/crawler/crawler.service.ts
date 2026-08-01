import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { CreateKnowledgeUrlRequest, KnowledgeSourceType } from "@sabsepehle/shared-types";
import { AppConfig } from "../common/config/configuration";
import { PrismaService } from "../common/prisma/prisma.service";
import { KnowledgeBaseService } from "../knowledge-base/knowledge-base.service";
import { SitemapService } from "../knowledge-base/sitemap.service";

type CrawlableSourceType = CreateKnowledgeUrlRequest["sourceType"];

export interface CrawlResult {
  source: string;
  pagesFound: number;
  pagesQueued: number;
  pagesFailed: number;
}

/**
 * Sitemap-driven crawler: discovers pages via /sitemap.xml and re-submits each
 * one through the existing single-URL ingestion path (KnowledgeBaseService.createFromUrl).
 * Change detection (skip re-embedding unchanged pages) happens downstream in
 * IngestionProcessor via a content checksum — this service's job is purely discovery
 * and scheduling, not deciding what changed.
 */
@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private websiteCrawlRunning = false;
  private irdaiCrawlRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly sitemapService: SitemapService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const { crawler } = this.config.get<AppConfig>("app")!;

    this.registerCronJob("website-crawl", crawler.websiteCron, () =>
      this.crawlWebsite().then(() => undefined),
    );
    this.logger.log(
      `Website crawl scheduled: "${crawler.websiteCron}" for ${crawler.companyWebsiteBaseUrl}`,
    );

    this.registerCronJob("irdai-crawl", crawler.irdaiCron, () => this.crawlIrdai().then(() => undefined));
    this.logger.log(`IRDAI crawl scheduled: "${crawler.irdaiCron}" for ${crawler.irdaiBaseUrl}`);
  }

  private registerCronJob(name: string, cronExpression: string, handler: () => Promise<void>): void {
    const job = new CronJob(cronExpression, () => {
      handler().catch((error) => this.logger.error(`Scheduled crawl "${name}" failed: ${error}`));
    });
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }

  async crawlWebsite(): Promise<CrawlResult> {
    if (this.websiteCrawlRunning) {
      this.logger.warn("Website crawl already in progress — skipping this trigger");
      return { source: "website", pagesFound: 0, pagesQueued: 0, pagesFailed: 0 };
    }
    const { crawler } = this.config.get<AppConfig>("app")!;
    this.websiteCrawlRunning = true;
    try {
      return await this.runCrawl(crawler.companyWebsiteBaseUrl, KnowledgeSourceType.WEBSITE);
    } finally {
      this.websiteCrawlRunning = false;
    }
  }

  async crawlIrdai(): Promise<CrawlResult> {
    if (this.irdaiCrawlRunning) {
      this.logger.warn("IRDAI crawl already in progress — skipping this trigger");
      return { source: "irdai", pagesFound: 0, pagesQueued: 0, pagesFailed: 0 };
    }
    const { crawler } = this.config.get<AppConfig>("app")!;
    this.irdaiCrawlRunning = true;
    try {
      return await this.runCrawl(crawler.irdaiBaseUrl, KnowledgeSourceType.IRDAI);
    } finally {
      this.irdaiCrawlRunning = false;
    }
  }

  private async runCrawl(baseUrl: string, sourceType: CrawlableSourceType): Promise<CrawlResult> {
    const log = await this.prisma.crawlLog.create({ data: { source: baseUrl, status: "running" } });

    let pagesFound = 0;
    let pagesQueued = 0;
    let pagesFailed = 0;

    try {
      const entries = await this.sitemapService.fetchSitemapUrls(baseUrl);
      pagesFound = entries.length;
      this.logger.log(`Sitemap discovered ${pagesFound} URL(s) for ${baseUrl}`);

      for (const entry of entries) {
        try {
          // createFromUrl upserts by sourceUrl and enqueues an ingestion job; the
          // job itself skips re-embedding if content is unchanged (checksum match).
          await this.knowledgeBaseService.createFromUrl({ url: entry.url, sourceType });
          pagesQueued++;
        } catch (error) {
          pagesFailed++;
          this.logger.warn(`Failed to queue ${entry.url}: ${error}`);
        }
      }

      await this.prisma.crawlLog.update({
        where: { id: log.id },
        data: {
          pagesFound,
          pagesIndexed: pagesQueued, // "queued for indexing" — actual indexing finishes async in the worker
          pagesFailed,
          status: "completed",
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Crawl of ${baseUrl} failed: ${message}`);
      await this.prisma.crawlLog.update({
        where: { id: log.id },
        data: { pagesFound, pagesFailed, status: "failed", errorMessage: message, finishedAt: new Date() },
      });
      throw error;
    }

    return { source: baseUrl, pagesFound, pagesQueued, pagesFailed };
  }
}

import { Controller, Get, Post, Query } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CrawlerService } from "./crawler.service";

@Controller("crawler")
export class CrawlerController {
  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly prisma: PrismaService,
  ) {}

  /** Manually trigger a crawl instead of waiting for the nightly schedule. */
  @Post("run")
  async run(@Query("source") source?: "website" | "irdai") {
    if (source === "irdai") {
      return this.crawlerService.crawlIrdai();
    }
    return this.crawlerService.crawlWebsite();
  }

  @Get("logs")
  async logs(@Query("limit") limit = "20") {
    return this.prisma.crawlLog.findMany({
      orderBy: { startedAt: "desc" },
      take: Math.min(Number(limit) || 20, 100),
    });
  }
}

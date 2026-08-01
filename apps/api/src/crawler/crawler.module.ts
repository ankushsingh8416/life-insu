import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { KnowledgeBaseModule } from "../knowledge-base/knowledge-base.module";
import { CrawlerService } from "./crawler.service";
import { CrawlerController } from "./crawler.controller";

@Module({
  imports: [ScheduleModule.forRoot(), KnowledgeBaseModule],
  controllers: [CrawlerController],
  providers: [CrawlerService],
  exports: [CrawlerService],
})
export class CrawlerModule {}

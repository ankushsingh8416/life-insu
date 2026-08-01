import { Module } from "@nestjs/common";
import { QueueModule } from "../queue/queue.module";
import { StorageModule } from "../storage/storage.module";
import { RagModule } from "../rag/rag.module";
import { KnowledgeBaseController } from "./knowledge-base.controller";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { ChunkingService } from "./chunking.service";
import { ContentExtractorService } from "./extractors/content-extractor.service";
import { IngestionProcessor } from "./processors/ingestion.processor";
import { SitemapService } from "./sitemap.service";
import { LiveLookupService } from "./live-lookup.service";

@Module({
  imports: [QueueModule, StorageModule, RagModule],
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    ChunkingService,
    ContentExtractorService,
    IngestionProcessor,
    SitemapService,
    LiveLookupService,
  ],
  exports: [KnowledgeBaseService, SitemapService, LiveLookupService],
})
export class KnowledgeBaseModule {}

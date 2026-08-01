import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import configuration from "./common/config/configuration";
import { validateEnv } from "./common/config/env.validation";
import { PrismaModule } from "./common/prisma/prisma.module";
import { RedisModule } from "./common/redis/redis.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HealthModule } from "./health/health.module";
import { VisitorsModule } from "./visitors/visitors.module";
import { AiProviderModule } from "./ai-provider/ai-provider.module";
import { RagModule } from "./rag/rag.module";
import { KnowledgeBaseModule } from "./knowledge-base/knowledge-base.module";
import { ChatModule } from "./chat/chat.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { StorageModule } from "./storage/storage.module";
import { QueueModule } from "./queue/queue.module";
import { CrawlerModule } from "./crawler/crawler.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [configuration],
      // In Docker, env vars are injected directly by docker-compose. For local
      // `npm run dev` (no containers), fall back to the monorepo root .env file.
      envFilePath: ["../../.env"],
      ignoreEnvFile: process.env.NODE_ENV === "production",
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: Number(process.env.RATE_LIMIT_TTL ?? 60) * 1000,
            limit: Number(process.env.RATE_LIMIT_MAX ?? 60),
          },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    HealthModule,
    VisitorsModule,
    AiProviderModule,
    RagModule,
    KnowledgeBaseModule,
    ChatModule,
    FeedbackModule,
    CrawlerModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}

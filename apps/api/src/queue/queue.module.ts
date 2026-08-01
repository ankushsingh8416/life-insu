import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../common/config/configuration";
import { QUEUE_NAMES } from "./queue.constants";

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { redis } = config.get<AppConfig>("app")!;
        const url = new URL(redis.url);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.KNOWLEDGE_INGESTION },
      { name: QUEUE_NAMES.CRAWLER },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}

import { Module } from "@nestjs/common";
import { AiOrchestratorService } from "./ai-provider.service";

@Module({
  providers: [AiOrchestratorService],
  exports: [AiOrchestratorService],
})
export class AiProviderModule {}

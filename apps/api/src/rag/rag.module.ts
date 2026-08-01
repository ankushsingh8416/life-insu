import { Module } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";
import { QdrantService } from "./qdrant.service";
import { RetrievalService } from "./retrieval.service";
import { PromptBuilderService } from "./prompt-builder.service";
import { GuardrailService } from "./guardrail.service";
import { RagService } from "./rag.service";

@Module({
  providers: [
    EmbeddingService,
    QdrantService,
    RetrievalService,
    PromptBuilderService,
    GuardrailService,
    RagService,
  ],
  exports: [RagService, EmbeddingService, QdrantService, GuardrailService],
})
export class RagModule {}

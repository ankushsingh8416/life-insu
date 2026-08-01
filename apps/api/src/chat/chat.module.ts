import { Module } from "@nestjs/common";
import { RagModule } from "../rag/rag.module";
import { AiProviderModule } from "../ai-provider/ai-provider.module";
import { KnowledgeBaseModule } from "../knowledge-base/knowledge-base.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatGateway } from "./chat.gateway";

@Module({
  imports: [RagModule, AiProviderModule, KnowledgeBaseModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}

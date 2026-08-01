import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";
import {
  CreateSessionRequest,
  CreateSessionRequestSchema,
  GetHistoryQuery,
  GetHistoryQuerySchema,
} from "@sabsepehle/shared-types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { Public } from "../common/decorators/public.decorator";
import { ChatService } from "./chat.service";
import { RagService } from "../rag/rag.service";

@Controller("chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly ragService: RagService,
  ) {}

  @Public()
  @Post("sessions")
  @UsePipes(new ZodValidationPipe(CreateSessionRequestSchema))
  async createSession(@Body() dto: CreateSessionRequest) {
    return this.chatService.createSession(dto.visitorId, dto.language);
  }

  @Public()
  @Get("messages")
  @UsePipes(new ZodValidationPipe(GetHistoryQuerySchema))
  async getHistory(@Query() query: GetHistoryQuery) {
    return this.chatService.getHistory(query);
  }

  @Public()
  @Get("suggested-questions")
  getSuggestedQuestions() {
    return { questions: this.ragService.getSuggestedQuestions() };
  }
}

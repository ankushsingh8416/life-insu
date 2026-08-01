import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { franc } from "franc-min";
import {
  ChatMessage,
  ChatSession,
  Citation,
  GetHistoryQuery,
  PaginatedResult,
} from "@sabsepehle/shared-types";
import { PrismaService } from "../common/prisma/prisma.service";
import { RagPlan, RagService } from "../rag/rag.service";
import { LiveLookupService } from "../knowledge-base/live-lookup.service";
import {
  AiOrchestratorService,
  AllProvidersUnavailableError,
  MidStreamProviderError,
} from "../ai-provider/ai-provider.service";

export interface StreamCallbacks {
  onCitations: (citations: Citation[]) => void;
  onToken: (token: string) => void;
}

const FRANC_TO_LOCALE: Record<string, string> = {
  hin: "hi",
  mar: "mr",
  guj: "gu",
  pan: "pa",
  tam: "ta",
  tel: "te",
  kan: "kn",
  mal: "ml",
  ben: "bn",
  urd: "ur",
  ori: "or",
  asm: "as",
  eng: "en",
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly liveLookupService: LiveLookupService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {}

  async createSession(visitorId: string, language?: string): Promise<ChatSession> {
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) {
      throw new BadRequestException("Unknown visitorId — register the visitor first");
    }

    const session = await this.prisma.chatSession.create({
      data: { visitorId, language: language ?? "en" },
    });

    return toSessionDto(session);
  }

  async getHistory(query: GetHistoryQuery): Promise<PaginatedResult<ChatMessage>> {
    const messages = await this.prisma.message.findMany({
      where: { sessionId: query.sessionId },
      orderBy: { createdAt: "asc" },
      take: query.limit,
    });

    return {
      items: messages.map(toMessageDto),
      page: 1,
      pageSize: query.limit,
      total: messages.length,
      totalPages: 1,
    };
  }

  /**
   * Persists the user's message, runs the RAG + guardrail pipeline, then streams
   * the assistant's reply token-by-token via the provided callbacks. Returns the
   * fully persisted assistant ChatMessage once the stream completes.
   */
  async handleUserMessage(
    sessionId: string,
    content: string,
    assistantMessageId: string,
    callbacks: StreamCallbacks,
  ): Promise<ChatMessage> {
    const session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);

    const detectedLanguage = detectLanguage(content);

    await this.prisma.message.create({
      data: {
        sessionId,
        role: "user",
        content,
        language: detectedLanguage,
      },
    });

    const history = await this.loadRecentHistory(sessionId, 1);
    return this.generateAssistantReply(sessionId, content, history, assistantMessageId, callbacks);
  }

  /**
   * Re-runs generation for the exchange that produced `assistantMessageId`: finds
   * the user message it answered, discards the old assistant message, and streams
   * a fresh reply (with a new message id) using the same conversation history.
   */
  async regenerateMessage(
    sessionId: string,
    assistantMessageId: string,
    newMessageId: string,
    callbacks: StreamCallbacks,
  ): Promise<ChatMessage> {
    const oldMessage = await this.prisma.message.findUnique({ where: { id: assistantMessageId } });
    if (!oldMessage || oldMessage.sessionId !== sessionId || oldMessage.role !== "assistant") {
      throw new NotFoundException(`Assistant message ${assistantMessageId} not found in session ${sessionId}`);
    }

    const precedingUserMessage = await this.prisma.message.findFirst({
      where: { sessionId, role: "user", createdAt: { lt: oldMessage.createdAt } },
      orderBy: { createdAt: "desc" },
    });
    if (!precedingUserMessage) {
      throw new NotFoundException("No preceding user message found to regenerate a reply for");
    }

    const history = await this.loadRecentHistory(sessionId, 0, precedingUserMessage.createdAt);
    await this.prisma.message.delete({ where: { id: assistantMessageId } });

    return this.generateAssistantReply(
      sessionId,
      precedingUserMessage.content,
      history,
      newMessageId,
      callbacks,
    );
  }

  private async loadRecentHistory(
    sessionId: string,
    skip: number,
    before?: Date,
  ): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const rows = await this.prisma.message.findMany({
      where: {
        sessionId,
        role: { in: ["user", "assistant"] },
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      skip,
    });
    return rows.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }

  /**
   * Runs the normal RAG pipeline; if it comes back with nothing grounded to
   * answer from (empty/low-confidence retrieval), tries a live fetch of the
   * company site before giving up — so "not in the knowledge base yet" doesn't
   * automatically mean "I don't know". Genuine out-of-domain / prompt-injection
   * rejections are never overridden here — only "no_supporting_context" is.
   */
  private async resolveAnswerPlan(
    query: string,
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<RagPlan> {
    const plan = await this.ragService.prepare(query, history);
    if (!plan.rejected || plan.rejectionReason !== "no_supporting_context") {
      return plan;
    }

    try {
      const live = await this.liveLookupService.attemptLiveLookup(query);
      if (live) {
        this.logger.log(`Live lookup found ${live.citations.length} source(s) for a query with no KB match`);
        return this.ragService.buildAnswerPlan(query, history, live.contextBlocks, live.citations, 0.5);
      }
    } catch (error) {
      this.logger.warn(`Live lookup fallback failed, falling back to decline: ${error}`);
    }

    return plan;
  }

  private async generateAssistantReply(
    sessionId: string,
    userContent: string,
    history: { role: "user" | "assistant"; content: string }[],
    assistantMessageId: string,
    callbacks: StreamCallbacks,
  ): Promise<ChatMessage> {
    const plan = await this.resolveAnswerPlan(userContent, history);
    callbacks.onCitations(plan.citations);

    let fullContent = "";
    let usage: { provider: string; model: string; tokensInput: number; tokensOutput: number; latencyMs: number } | null = null;

    try {
      const generator = this.aiOrchestrator.streamChatCompletion(plan.messages);
      let next = await generator.next();
      while (!next.done) {
        fullContent += next.value;
        callbacks.onToken(next.value);
        next = await generator.next();
      }
      usage = next.value;
    } catch (error) {
      const message = await this.persistFailedMessage(sessionId, assistantMessageId, fullContent, error);
      throw message;
    }

    const status = plan.rejected ? "rejected_out_of_domain" : "complete";

    const saved = await this.prisma.message.create({
      data: {
        id: assistantMessageId,
        sessionId,
        role: "assistant",
        content: fullContent,
        citations: plan.citations as unknown as object,
        status,
        confidenceScore: plan.confidenceScore,
        provider: usage?.provider,
        model: usage?.model,
        tokensInput: usage?.tokensInput,
        tokensOutput: usage?.tokensOutput,
        latencyMs: usage?.latencyMs,
      },
    });

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return toMessageDto(saved);
  }

  private async persistFailedMessage(
    sessionId: string,
    messageId: string,
    partialContent: string,
    error: unknown,
  ): Promise<Error> {
    const reason =
      error instanceof AllProvidersUnavailableError
        ? "All AI providers are currently unavailable. Please try again shortly."
        : error instanceof MidStreamProviderError
          ? "The AI provider stopped responding mid-answer. Please try again."
          : "Something went wrong while generating a response.";

    await this.prisma.message.create({
      data: {
        id: messageId,
        sessionId,
        role: "assistant",
        content: partialContent,
        status: "error",
      },
    });

    this.logger.error(`Chat generation failed for session ${sessionId}: ${error}`);
    return new Error(reason);
  }
}

function detectLanguage(text: string): string {
  if (text.trim().length < 3) return "en";
  const code = franc(text, { minLength: 3 });
  return FRANC_TO_LOCALE[code] ?? "en";
}

function toSessionDto(session: {
  id: string;
  visitorId: string;
  title: string | null;
  language: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): ChatSession {
  return {
    id: session.id,
    visitorId: session.visitorId,
    title: session.title,
    language: session.language,
    status: session.status as ChatSession["status"],
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function toMessageDto(message: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  citations: unknown;
  status: string;
  confidenceScore: number | null;
  provider: string | null;
  model: string | null;
  language: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  latencyMs: number | null;
  createdAt: Date;
}): ChatMessage {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role as ChatMessage["role"],
    content: message.content,
    citations: (message.citations as Citation[]) ?? [],
    status: message.status as ChatMessage["status"],
    confidenceScore: message.confidenceScore,
    provider: message.provider,
    model: message.model,
    language: message.language,
    tokensInput: message.tokensInput,
    tokensOutput: message.tokensOutput,
    latencyMs: message.latencyMs,
    createdAt: message.createdAt.toISOString(),
  };
}

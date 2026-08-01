import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { Citation } from "@sabsepehle/shared-types";
import { AppConfig } from "../common/config/configuration";
import { ChatMessageInput } from "../ai-provider/ai-provider.interface";
import { PrismaService } from "../common/prisma/prisma.service";
import { GuardrailService, isRecencyContentQuery } from "./guardrail.service";
import { RetrievalService } from "./retrieval.service";
import { PromptBuilderService } from "./prompt-builder.service";

export interface RagPlan {
  rejected: boolean;
  rejectionReason?: string;
  messages: ChatMessageInput[];
  citations: Citation[];
  confidenceScore: number;
}

const SUGGESTED_QUESTIONS_FALLBACK = [
  "What is the difference between term insurance and whole life insurance?",
  "What tax benefits do I get under Section 80C and 80D?",
  "How do I file a health insurance claim?",
  "What does IRDAI regulate for life insurance companies?",
];

const RECENCY_CANDIDATE_COUNT = 3;

@Injectable()
export class RagService {
  constructor(
    private readonly config: ConfigService,
    private readonly guardrailService: GuardrailService,
    private readonly retrievalService: RetrievalService,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly prisma: PrismaService,
  ) {}

  async prepare(
    query: string,
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<RagPlan> {
    const { rag } = this.config.get<AppConfig>("app")!;
    const intent = this.guardrailService.classifyIntent(query);

    if (!intent.allowed) {
      return {
        rejected: true,
        rejectionReason: intent.reason,
        citations: [],
        confidenceScore: 0,
        messages: this.promptBuilderService.buildConversation(
          this.promptBuilderService.buildOutOfDomainPrompt(),
          history,
          query,
        ),
      };
    }

    // "What's your latest blog post" etc: a similarity score has no notion of
    // "recent", so vector retrieval structurally cannot answer this class of
    // question — checked before retrieval, not as a fallback after it fails.
    if (isRecencyContentQuery(query)) {
      const recencyPlan = await this.buildRecencyPlan(query, history);
      if (recencyPlan) return recencyPlan;
      // No indexed "/learn/" content yet — fall through to normal handling below,
      // which will end in "no_supporting_context" and give ChatService a chance
      // to try LiveLookupService's live-fetch recency path instead.
    }

    const retrieved = await this.retrievalService.retrieve(query);

    // Identity/meta questions ("who are you", "what is Sabse Pehle Life Insurance")
    // are answerable from the system prompt's own identity block and must never be
    // blocked by the no-supporting-context guard below, even with an empty KB.
    if (intent.matchedCategory === "meta") {
      return {
        rejected: false,
        citations: retrieved.citations,
        confidenceScore: retrieved.topScore,
        messages: this.promptBuilderService.buildConversation(
          this.promptBuilderService.buildMetaPrompt(retrieved.contextBlocks),
          history,
          query,
        ),
      };
    }

    // No supporting evidence in the knowledge base — regardless of whether the
    // intent matched an in-domain keyword outright or was only ambiguous, an empty/
    // low-confidence retrieval means we have nothing grounded to answer from.
    // (ChatService gets a chance to try a live site lookup before this becomes a
    // final decline — see ChatService.generateAssistantReply.)
    if (retrieved.topScore < rag.minSimilarity) {
      return {
        rejected: true,
        rejectionReason: "no_supporting_context",
        citations: [],
        confidenceScore: 0,
        messages: this.promptBuilderService.buildConversation(
          this.promptBuilderService.buildOutOfDomainPrompt(),
          history,
          query,
        ),
      };
    }

    return {
      rejected: false,
      citations: retrieved.citations,
      confidenceScore: retrieved.topScore,
      messages: this.promptBuilderService.buildConversation(
        this.promptBuilderService.buildAnsweringPrompt(retrieved.contextBlocks),
        history,
        query,
      ),
    };
  }

  /**
   * Answers "latest blog post" style questions from indexed-document metadata
   * (updatedAt) rather than embeddings. Returns null if nothing indexed yet under
   * /learn/, letting the caller fall back to the normal (eventually live-fetch) path.
   */
  private async buildRecencyPlan(
    query: string,
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<RagPlan | null> {
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { status: "indexed", sourceUrl: { contains: "/learn/" } },
      orderBy: { updatedAt: "desc" },
      take: RECENCY_CANDIDATE_COUNT,
    });
    if (docs.length === 0) return null;

    const firstChunks = await this.prisma.knowledgeChunk.findMany({
      where: { documentId: { in: docs.map((d) => d.id) }, chunkIndex: 0 },
    });
    const chunkByDocId = new Map(firstChunks.map((c) => [c.documentId, c]));

    const contextBlocks: string[] = [];
    const citations: Citation[] = [];

    docs.forEach((doc, index) => {
      const chunk = chunkByDocId.get(doc.id);
      const content = chunk?.content ?? "";
      const updatedLabel = doc.updatedAt.toISOString().slice(0, 10);
      contextBlocks.push(`[Updated ${updatedLabel} — most recent rank #${index + 1}] ${doc.title}\n${content}`);
      citations.push({
        documentId: doc.id,
        chunkId: chunk?.id ?? randomUUID(),
        title: doc.title,
        sourceUrl: doc.sourceUrl,
        snippet: content.slice(0, 280),
        score: Math.max(1 - index * 0.05, 0.5), // ranked by recency, not vector similarity
      });
    });

    return {
      rejected: false,
      citations,
      confidenceScore: 0.9,
      messages: this.promptBuilderService.buildConversation(
        this.promptBuilderService.buildRecencyAnsweringPrompt(contextBlocks),
        history,
        query,
      ),
    };
  }

  /**
   * Builds a normal (non-rejected) answer plan from context that came from
   * somewhere other than Qdrant retrieval — specifically, LiveLookupService's
   * live site fetch. Kept here so prompt assembly stays in one place.
   */
  buildAnswerPlan(
    query: string,
    history: { role: "user" | "assistant"; content: string }[],
    contextBlocks: string[],
    citations: Citation[],
    confidenceScore: number,
  ): RagPlan {
    return {
      rejected: false,
      citations,
      confidenceScore,
      messages: this.promptBuilderService.buildConversation(
        this.promptBuilderService.buildAnsweringPrompt(contextBlocks),
        history,
        query,
      ),
    };
  }

  getSuggestedQuestions(): string[] {
    return SUGGESTED_QUESTIONS_FALLBACK;
  }
}

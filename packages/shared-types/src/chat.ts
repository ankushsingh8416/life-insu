import { z } from "zod";
import { ChatRole, MessageStatus, ChatSessionStatus } from "./enums";

export const CitationSchema = z.object({
  documentId: z.string().uuid(),
  chunkId: z.string().uuid(),
  title: z.string(),
  sourceUrl: z.string().url().nullable(),
  snippet: z.string(),
  score: z.number().min(0).max(1),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.enum([ChatRole.USER, ChatRole.ASSISTANT, ChatRole.SYSTEM]),
  content: z.string(),
  citations: z.array(CitationSchema).default([]),
  confidenceScore: z.number().min(0).max(1).nullable().optional(),
  status: z
    .enum([
      MessageStatus.PENDING,
      MessageStatus.STREAMING,
      MessageStatus.COMPLETE,
      MessageStatus.ERROR,
      MessageStatus.REJECTED_OUT_OF_DOMAIN,
    ])
    .default(MessageStatus.COMPLETE),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  tokensInput: z.number().int().nullable().optional(),
  tokensOutput: z.number().int().nullable().optional(),
  latencyMs: z.number().int().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSessionSchema = z.object({
  id: z.string().uuid(),
  visitorId: z.string().uuid(),
  title: z.string().nullable(),
  language: z.string().default("en"),
  status: z.enum([ChatSessionStatus.ACTIVE, ChatSessionStatus.CLOSED, ChatSessionStatus.EXPIRED]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;

// ---- REST DTOs ----

export const SendMessageRequestSchema = z.object({
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  content: z.string().min(1).max(4000),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const CreateSessionRequestSchema = z.object({
  visitorId: z.string().uuid(),
  language: z.string().optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const GetHistoryQuerySchema = z.object({
  sessionId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type GetHistoryQuery = z.infer<typeof GetHistoryQuerySchema>;

export const RegenerateRequestSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
});
export type RegenerateRequest = z.infer<typeof RegenerateRequestSchema>;

// ---- Socket.IO event payloads ----

export const ClientToServerEvents = {
  SEND_MESSAGE: "chat:send",
  REGENERATE: "chat:regenerate",
  TYPING: "chat:typing",
  JOIN_SESSION: "chat:join",
} as const;

export const ServerToClientEvents = {
  TOKEN: "chat:token",
  CITATIONS: "chat:citations",
  MESSAGE_COMPLETE: "chat:complete",
  MESSAGE_REJECTED: "chat:rejected",
  ERROR: "chat:error",
} as const;

export const StreamTokenEventSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  token: z.string(),
});
export type StreamTokenEvent = z.infer<typeof StreamTokenEventSchema>;

export const StreamCompleteEventSchema = z.object({
  sessionId: z.string().uuid(),
  message: ChatMessageSchema,
});
export type StreamCompleteEvent = z.infer<typeof StreamCompleteEventSchema>;

export const StreamRejectedEventSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  reason: z.string(),
  suggestedQuestions: z.array(z.string()).default([]),
});
export type StreamRejectedEvent = z.infer<typeof StreamRejectedEventSchema>;

export const StreamErrorEventSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  message: z.string(),
});
export type StreamErrorEvent = z.infer<typeof StreamErrorEventSchema>;

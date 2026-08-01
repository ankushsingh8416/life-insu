export const ChatRole = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
} as const;
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

export const MessageStatus = {
  PENDING: "pending",
  STREAMING: "streaming",
  COMPLETE: "complete",
  ERROR: "error",
  REJECTED_OUT_OF_DOMAIN: "rejected_out_of_domain",
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const FeedbackRating = {
  LIKE: "like",
  DISLIKE: "dislike",
} as const;
export type FeedbackRating = (typeof FeedbackRating)[keyof typeof FeedbackRating];

export const AiProviderId = {
  OPENAI: "openai",
  GEMINI: "gemini",
  GEMINI_FLASH: "gemini-flash",
} as const;
export type AiProviderId = (typeof AiProviderId)[keyof typeof AiProviderId];

export const KnowledgeSourceType = {
  PDF: "pdf",
  DOCX: "docx",
  TXT: "txt",
  CSV: "csv",
  URL: "url",
  WEBSITE: "website",
  IRDAI: "irdai",
} as const;
export type KnowledgeSourceType = (typeof KnowledgeSourceType)[keyof typeof KnowledgeSourceType];

export const KnowledgeDocumentStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  INDEXED: "indexed",
  FAILED: "failed",
  STALE: "stale",
} as const;
export type KnowledgeDocumentStatus =
  (typeof KnowledgeDocumentStatus)[keyof typeof KnowledgeDocumentStatus];

export const ChatSessionStatus = {
  ACTIVE: "active",
  CLOSED: "closed",
  EXPIRED: "expired",
} as const;
export type ChatSessionStatus = (typeof ChatSessionStatus)[keyof typeof ChatSessionStatus];

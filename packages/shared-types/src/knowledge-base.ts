import { z } from "zod";
import { KnowledgeDocumentStatus, KnowledgeSourceType } from "./enums";

export const KnowledgeDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  sourceType: z.enum([
    KnowledgeSourceType.PDF,
    KnowledgeSourceType.DOCX,
    KnowledgeSourceType.TXT,
    KnowledgeSourceType.CSV,
    KnowledgeSourceType.URL,
    KnowledgeSourceType.WEBSITE,
    KnowledgeSourceType.IRDAI,
  ]),
  sourceUrl: z.string().url().nullable(),
  s3Key: z.string().nullable(),
  status: z.enum([
    KnowledgeDocumentStatus.PENDING,
    KnowledgeDocumentStatus.PROCESSING,
    KnowledgeDocumentStatus.INDEXED,
    KnowledgeDocumentStatus.FAILED,
    KnowledgeDocumentStatus.STALE,
  ]),
  chunkCount: z.number().int().default(0),
  checksum: z.string().nullable(),
  failureReason: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

export const CreateKnowledgeUrlRequestSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(300).optional(),
  sourceType: z
    .enum([KnowledgeSourceType.URL, KnowledgeSourceType.WEBSITE, KnowledgeSourceType.IRDAI])
    .default(KnowledgeSourceType.URL),
});
export type CreateKnowledgeUrlRequest = z.infer<typeof CreateKnowledgeUrlRequestSchema>;

export const KnowledgeChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  content: z.string(),
  chunkIndex: z.number().int(),
  tokenCount: z.number().int(),
  qdrantPointId: z.string(),
  createdAt: z.string().datetime(),
});
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;

export const ListKnowledgeDocumentsQuerySchema = z.object({
  status: z
    .enum([
      KnowledgeDocumentStatus.PENDING,
      KnowledgeDocumentStatus.PROCESSING,
      KnowledgeDocumentStatus.INDEXED,
      KnowledgeDocumentStatus.FAILED,
      KnowledgeDocumentStatus.STALE,
    ])
    .optional(),
  sourceType: z
    .enum([
      KnowledgeSourceType.PDF,
      KnowledgeSourceType.DOCX,
      KnowledgeSourceType.TXT,
      KnowledgeSourceType.CSV,
      KnowledgeSourceType.URL,
      KnowledgeSourceType.WEBSITE,
      KnowledgeSourceType.IRDAI,
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListKnowledgeDocumentsQuery = z.infer<typeof ListKnowledgeDocumentsQuerySchema>;

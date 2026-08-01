import { z } from "zod";

export const VisitorSchema = z.object({
  id: z.string().uuid(),
  language: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  device: z.string().nullable(),
  browser: z.string().nullable(),
  os: z.string().nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});
export type Visitor = z.infer<typeof VisitorSchema>;

export const RegisterVisitorRequestSchema = z.object({
  visitorId: z.string().uuid().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});
export type RegisterVisitorRequest = z.infer<typeof RegisterVisitorRequestSchema>;

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  matchedCategory?: "in_domain" | "out_of_domain" | "prompt_injection" | "pii_detected" | "meta";
}

/** Supported UI locales for Phase 1 chat shell (AI replies adapt to any detected language). */
export const SUPPORTED_UI_LOCALES = [
  "en",
  "hi",
  "mr",
  "gu",
  "pa",
  "ta",
  "te",
  "kn",
  "ml",
  "bn",
  "ur",
  "or",
  "as",
] as const;
export type SupportedUiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

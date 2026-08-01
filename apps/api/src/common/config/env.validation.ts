import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  QDRANT_URL: z.string().min(1, "QDRANT_URL is required"),
  QDRANT_API_KEY: z.string().optional().default(""),
  QDRANT_COLLECTION: z.string().default("insurance_knowledge_base"),

  AI_PRIMARY_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  AI_SECONDARY_PROVIDER: z.enum(["openai", "gemini"]).default("gemini"),
  AI_FALLBACK_PROVIDER: z.literal("gemini-flash").default("gemini-flash"),

  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_CHAT_MODEL: z.string().default("gpt-5.5"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-large"),

  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-pro"),
  GEMINI_FLASH_MODEL: z.string().default("gemini-2.5-flash"),

  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  AI_TOP_P: z.coerce.number().min(0).max(1).default(0.9),
  AI_FREQUENCY_PENALTY: z.coerce.number().min(-2).max(2).default(0),
  AI_PRESENCE_PENALTY: z.coerce.number().min(-2).max(2).default(0),
  AI_MAX_TOKENS: z.coerce.number().int().default(1024),

  RAG_TOP_K: z.coerce.number().int().default(10),
  RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.72),
  RAG_CHUNK_SIZE: z.coerce.number().int().default(800),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().default(120),

  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string().optional().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(""),
  AWS_S3_BUCKET: z.string().optional().default(""),

  COMPANY_WEBSITE_BASE_URL: z.string().default("https://sabsepehlelifeinsurance.com"),
  CRAWLER_WEBSITE_SCHEDULE_CRON: z.string().default("0 2 * * *"),
  IRDAI_BASE_URL: z.string().default("https://irdai.gov.in"),
  CRAWLER_IRDAI_SCHEDULE_CRON: z.string().default("0 */12 * * *"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  COOKIE_SECRET: z.string().min(8),

  RATE_LIMIT_TTL: z.coerce.number().int().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().default(60),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return parsed.data;
}

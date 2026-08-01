import { EnvConfig, validateEnv } from "./env.validation";

export interface AppConfig {
  env: "development" | "production" | "test";
  port: number;
  appUrl: string;
  corsOrigin: string[];
  database: { url: string };
  redis: { url: string };
  qdrant: { url: string; apiKey: string; collection: string };
  ai: {
    primaryProvider: "openai" | "gemini";
    secondaryProvider: "openai" | "gemini";
    fallbackProvider: "gemini-flash";
    openai: { apiKey: string; chatModel: string; embeddingModel: string };
    gemini: { apiKey: string; chatModel: string; flashModel: string };
    generation: {
      temperature: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
      maxTokens: number;
    };
  };
  rag: { topK: number; minSimilarity: number; chunkSize: number; chunkOverlap: number };
  aws: { region: string; accessKeyId: string; secretAccessKey: string; bucket: string };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cookieSecret: string;
  rateLimit: { ttl: number; max: number };
  crawler: {
    companyWebsiteBaseUrl: string;
    websiteCron: string;
    irdaiBaseUrl: string;
    irdaiCron: string;
  };
}

export function buildConfig(env: EnvConfig): AppConfig {
  return {
    env: env.NODE_ENV,
    port: env.API_PORT,
    appUrl: env.APP_URL,
    corsOrigin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    qdrant: {
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
      collection: env.QDRANT_COLLECTION,
    },
    ai: {
      primaryProvider: env.AI_PRIMARY_PROVIDER,
      secondaryProvider: env.AI_SECONDARY_PROVIDER,
      fallbackProvider: env.AI_FALLBACK_PROVIDER,
      openai: {
        apiKey: env.OPENAI_API_KEY,
        chatModel: env.OPENAI_CHAT_MODEL,
        embeddingModel: env.OPENAI_EMBEDDING_MODEL,
      },
      gemini: {
        apiKey: env.GEMINI_API_KEY,
        chatModel: env.GEMINI_CHAT_MODEL,
        flashModel: env.GEMINI_FLASH_MODEL,
      },
      generation: {
        temperature: env.AI_TEMPERATURE,
        topP: env.AI_TOP_P,
        frequencyPenalty: env.AI_FREQUENCY_PENALTY,
        presencePenalty: env.AI_PRESENCE_PENALTY,
        maxTokens: env.AI_MAX_TOKENS,
      },
    },
    rag: {
      topK: env.RAG_TOP_K,
      minSimilarity: env.RAG_MIN_SIMILARITY,
      chunkSize: env.RAG_CHUNK_SIZE,
      chunkOverlap: env.RAG_CHUNK_OVERLAP,
    },
    aws: {
      region: env.AWS_REGION,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      bucket: env.AWS_S3_BUCKET,
    },
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshSecret: env.JWT_REFRESH_SECRET,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    cookieSecret: env.COOKIE_SECRET,
    rateLimit: { ttl: env.RATE_LIMIT_TTL, max: env.RATE_LIMIT_MAX },
    crawler: {
      companyWebsiteBaseUrl: env.COMPANY_WEBSITE_BASE_URL,
      websiteCron: env.CRAWLER_WEBSITE_SCHEDULE_CRON,
      irdaiBaseUrl: env.IRDAI_BASE_URL,
      irdaiCron: env.CRAWLER_IRDAI_SCHEDULE_CRON,
    },
  };
}

export default function configuration(): { app: AppConfig } {
  // ConfigModule's `validate` option (see app.module.ts) already ran validateEnv
  // once; re-running it here is cheap and keeps this factory pure/self-contained.
  return { app: buildConfig(validateEnv(process.env)) };
}

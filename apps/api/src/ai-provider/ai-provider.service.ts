import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../common/config/configuration";
import {
  AiProvider,
  ChatCompletionUsage,
  ChatMessageInput,
  GenerationParams,
} from "./ai-provider.interface";
import { OpenAiProvider } from "./providers/openai.provider";
import { GeminiProvider } from "./providers/gemini.provider";

export class AllProvidersUnavailableError extends Error {
  constructor(public readonly attempted: string[]) {
    super(`All AI providers failed before producing a response: ${attempted.join(" -> ")}`);
  }
}

export class MidStreamProviderError extends Error {
  constructor(
    public readonly provider: string,
    public override readonly cause: unknown,
  ) {
    super(`Provider "${provider}" failed mid-stream`);
  }
}

@Injectable()
export class AiOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private readonly providers = new Map<string, AiProvider>();
  private chain: string[] = [];
  private generationDefaults!: GenerationParams;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const { ai } = this.config.get<AppConfig>("app")!;
    this.generationDefaults = ai.generation;

    if (ai.openai.apiKey) {
      this.providers.set("openai", new OpenAiProvider(ai.openai.apiKey, ai.openai.chatModel));
    } else {
      this.logger.warn("OPENAI_API_KEY not set — openai provider disabled");
    }

    if (ai.gemini.apiKey) {
      this.providers.set(
        "gemini",
        new GeminiProvider(ai.gemini.apiKey, ai.gemini.chatModel, "gemini"),
      );
      this.providers.set(
        "gemini-flash",
        new GeminiProvider(ai.gemini.apiKey, ai.gemini.flashModel, "gemini-flash"),
      );
    } else {
      this.logger.warn("GEMINI_API_KEY not set — gemini/gemini-flash providers disabled");
    }

    this.chain = [...new Set([ai.primaryProvider, ai.secondaryProvider, ai.fallbackProvider])].filter(
      (id) => this.providers.has(id),
    );

    if (this.chain.length === 0) {
      this.logger.error(
        "No AI providers are configured. Set OPENAI_API_KEY and/or GEMINI_API_KEY.",
      );
    } else {
      this.logger.log(`AI provider fallback chain: ${this.chain.join(" -> ")}`);
    }
  }

  /**
   * Streams a chat completion, walking the provider fallback chain.
   *
   * Fallback only happens BEFORE the first token is emitted (connection/auth/
   * rate-limit failures). Once a provider has started streaming to the caller,
   * a mid-stream failure is surfaced as MidStreamProviderError instead of silently
   * retrying on a different provider — retrying would duplicate/garble content the
   * client already rendered.
   */
  async *streamChatCompletion(
    messages: ChatMessageInput[],
    paramsOverride?: Partial<GenerationParams>,
  ): AsyncGenerator<string, ChatCompletionUsage, void> {
    const params = { ...this.generationDefaults, ...paramsOverride };
    const attempted: string[] = [];

    for (const providerId of this.chain) {
      const provider = this.providers.get(providerId)!;
      attempted.push(providerId);
      const generator = provider.streamChatCompletion(messages, params);

      let first: IteratorResult<string, ChatCompletionUsage>;
      try {
        first = await generator.next();
      } catch (error) {
        this.logger.warn(`Provider "${providerId}" failed before first token: ${error}`);
        continue;
      }

      // Provider accepted the request — commit to it for the rest of the stream.
      try {
        if (!first.done) {
          yield first.value;
          let next = await generator.next();
          while (!next.done) {
            yield next.value;
            next = await generator.next();
          }
          return next.value;
        }
        return first.value;
      } catch (error) {
        throw new MidStreamProviderError(providerId, error);
      }
    }

    throw new AllProvidersUnavailableError(attempted);
  }
}

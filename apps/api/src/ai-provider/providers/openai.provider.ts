import { Logger } from "@nestjs/common";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import {
  AiProvider,
  ChatCompletionUsage,
  ChatMessageInput,
  GenerationParams,
} from "../ai-provider.interface";

/** Matches OpenAI's 400 response when a reasoning-family model (o1/o3/gpt-5.x
 * reasoning) rejects a sampling parameter it doesn't support at non-default values. */
const UNSUPPORTED_SAMPLING_PARAM = /does not support .* with this model|unsupported (value|parameter)/i;

export class OpenAiProvider implements AiProvider {
  readonly id = "openai";
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  /** Once we learn this model rejects custom sampling params, stop sending them. */
  private samplingParamsSupported = true;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async *streamChatCompletion(
    messages: ChatMessageInput[],
    params: GenerationParams,
  ): AsyncGenerator<string, ChatCompletionUsage, void> {
    const start = Date.now();
    let tokensInput = 0;
    let tokensOutput = 0;

    let stream;
    try {
      stream = await this.client.chat.completions.create(this.buildRequest(messages, params));
    } catch (error) {
      if (this.samplingParamsSupported && error instanceof OpenAI.APIError && error.status === 400 && UNSUPPORTED_SAMPLING_PARAM.test(error.message)) {
        // This model (typically a reasoning-family model) only accepts default
        // temperature/top_p/penalties. Remember that and retry once without them,
        // rather than failing this and every subsequent request on this provider.
        this.logger.warn(
          `Model "${this.model}" rejected custom sampling params (${error.message}) — retrying with defaults and disabling them going forward`,
        );
        this.samplingParamsSupported = false;
        stream = await this.client.chat.completions.create(this.buildRequest(messages, params));
      } else {
        throw error;
      }
    }

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) yield token;
      if (chunk.usage) {
        tokensInput = chunk.usage.prompt_tokens;
        tokensOutput = chunk.usage.completion_tokens;
      }
    }

    return {
      provider: this.id,
      model: this.model,
      tokensInput,
      tokensOutput,
      latencyMs: Date.now() - start,
    };
  }

  private buildRequest(
    messages: ChatMessageInput[],
    params: GenerationParams,
  ): ChatCompletionCreateParamsStreaming {
    return {
      model: this.model,
      messages,
      // Newer OpenAI models (o1/o3/gpt-5.x reasoning family) reject the legacy
      // `max_tokens` param and require `max_completion_tokens` instead.
      max_completion_tokens: params.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
      ...(this.samplingParamsSupported
        ? {
            temperature: params.temperature,
            top_p: params.topP,
            frequency_penalty: params.frequencyPenalty,
            presence_penalty: params.presencePenalty,
          }
        : {}),
    };
  }
}

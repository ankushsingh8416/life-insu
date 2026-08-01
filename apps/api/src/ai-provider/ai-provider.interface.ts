export interface ChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerationParams {
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxTokens: number;
}

export interface ChatCompletionUsage {
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
}

/**
 * Every AI backend (OpenAI, Gemini, Gemini Flash, future Llama/Mistral/DeepSeek)
 * implements this single contract. Swapping providers is purely a matter of which
 * implementation gets bound in AiProviderModule based on env vars — nothing else
 * in the codebase depends on a concrete provider.
 *
 * Embeddings are intentionally NOT part of this interface: the whole knowledge
 * base is indexed in one fixed embedding space (see rag/embedding.service.ts),
 * and swapping the chat completion provider must never change that space.
 */
export interface AiProvider {
  readonly id: string;
  readonly model: string;

  /**
   * Streams completion tokens as they arrive. The generator's return value
   * carries final usage stats (available only once the stream is exhausted).
   */
  streamChatCompletion(
    messages: ChatMessageInput[],
    params: GenerationParams,
  ): AsyncGenerator<string, ChatCompletionUsage, void>;
}

export const AI_PROVIDER_REGISTRY = Symbol("AI_PROVIDER_REGISTRY");

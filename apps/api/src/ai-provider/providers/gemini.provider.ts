import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AiProvider,
  ChatCompletionUsage,
  ChatMessageInput,
  GenerationParams,
} from "../ai-provider.interface";

export class GeminiProvider implements AiProvider {
  private readonly client: GoogleGenerativeAI;

  constructor(
    apiKey: string,
    readonly model: string,
    readonly id: "gemini" | "gemini-flash" = "gemini",
  ) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async *streamChatCompletion(
    messages: ChatMessageInput[],
    params: GenerationParams,
  ): AsyncGenerator<string, ChatCompletionUsage, void> {
    const start = Date.now();

    const systemMessages = messages.filter((m) => m.role === "system");
    const conversation = messages.filter((m) => m.role !== "system");
    const last = conversation.at(-1);
    const history = conversation.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemMessages.map((m) => m.content).join("\n\n") || undefined,
      generationConfig: {
        temperature: params.temperature,
        topP: params.topP,
        maxOutputTokens: params.maxTokens,
      },
    });

    const chat = generativeModel.startChat({ history });
    const result = await chat.sendMessageStream(last?.content ?? "");

    let tokensOutput = 0;
    for await (const chunk of result.stream) {
      const token = chunk.text();
      if (token) {
        tokensOutput += Math.ceil(token.length / 4);
        yield token;
      }
    }

    const usageMeta = (await result.response).usageMetadata;

    return {
      provider: this.id,
      model: this.model,
      tokensInput: usageMeta?.promptTokenCount ?? 0,
      tokensOutput: usageMeta?.candidatesTokenCount ?? tokensOutput,
      latencyMs: Date.now() - start,
    };
  }
}

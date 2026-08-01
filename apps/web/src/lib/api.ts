import {
  ApiResponse,
  ChatMessage,
  ChatSession,
  CreateSessionRequest,
  Feedback,
  PaginatedResult,
  RegisterVisitorRequest,
  SubmitFeedbackRequest,
  Visitor,
} from "@sabsepehle/shared-types";
import { API_URL } from "./config";

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.success) {
    const message = !body.success ? body.error.message : `Request to ${path} failed`;
    throw new ApiError(message, response.status);
  }

  return body.data;
}

export const api = {
  registerVisitor: (dto: RegisterVisitorRequest) =>
    request<Visitor>("/visitors/register", { method: "POST", body: JSON.stringify(dto) }),

  createSession: (dto: CreateSessionRequest) =>
    request<ChatSession>("/chat/sessions", { method: "POST", body: JSON.stringify(dto) }),

  getHistory: (sessionId: string, limit = 50) =>
    request<PaginatedResult<ChatMessage>>(
      `/chat/messages?sessionId=${encodeURIComponent(sessionId)}&limit=${limit}`,
    ),

  getSuggestedQuestions: () =>
    request<{ questions: string[] }>("/chat/suggested-questions"),

  submitFeedback: (dto: SubmitFeedbackRequest) =>
    request<Feedback>("/feedback", { method: "POST", body: JSON.stringify(dto) }),
};

export { ApiError };

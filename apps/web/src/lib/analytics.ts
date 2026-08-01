type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

export type ChatAnalyticsEvent =
  | "chat_started"
  | "question_asked"
  | "conversation_finished"
  | "feedback_submitted";

export function trackEvent(event: ChatAnalyticsEvent, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", event, params);
}

import { VISITOR_ID_STORAGE_KEY, SESSION_ID_STORAGE_KEY } from "./config";

export function getStoredVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(VISITOR_ID_STORAGE_KEY);
}

export function setStoredVisitorId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
}

// Session id is kept in localStorage (not sessionStorage) so a conversation
// survives page reloads and browser restarts — "Persistent Session" / "Continue
// Conversation". "Clear Chat" explicitly removes it to start a fresh session.
export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_ID_STORAGE_KEY);
}

export function setStoredSessionId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_ID_STORAGE_KEY, id);
}

export function clearStoredSessionId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_ID_STORAGE_KEY);
}

export function detectBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  return navigator.language?.split("-")[0] ?? "en";
}

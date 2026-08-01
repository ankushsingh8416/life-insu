"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearStoredSessionId, getStoredSessionId, setStoredSessionId } from "@/lib/visitor";
import { trackEvent } from "@/lib/analytics";

export function useChatSession(
  visitorId: string | null,
  language: string,
  forcedSessionId?: string,
) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const createNewSession = useCallback(
    async (currentVisitorId: string) => {
      const session = await api.createSession({ visitorId: currentVisitorId, language });
      setStoredSessionId(session.id);
      setSessionId(session.id);
      trackEvent("chat_started", { sessionId: session.id });
      return session.id;
    },
    [language],
  );

  useEffect(() => {
    if (!visitorId) return;
    let cancelled = false;

    async function init() {
      setError(null);
      try {
        if (forcedSessionId) {
          setStoredSessionId(forcedSessionId);
          if (!cancelled) setSessionId(forcedSessionId);
          return;
        }
        const existing = getStoredSessionId();
        if (existing) {
          if (!cancelled) setSessionId(existing);
        } else {
          await createNewSession(visitorId!);
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't connect to Sabse Pehle AI. Please check your connection and try again.");
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId, forcedSessionId, retryToken]);

  const startNewChat = useCallback(async () => {
    if (!visitorId) return;
    clearStoredSessionId();
    setSessionId(null);
    setError(null);
    try {
      await createNewSession(visitorId);
    } catch {
      setError("Couldn't start a new conversation. Please try again.");
    }
  }, [visitorId, createNewSession]);

  const retry = useCallback(() => setRetryToken((n) => n + 1), []);

  return { sessionId, isReady, error, startNewChat, retry };
}

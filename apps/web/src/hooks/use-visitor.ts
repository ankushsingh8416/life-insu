"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/lib/api";
import { detectBrowserLanguage, getStoredVisitorId, setStoredVisitorId } from "@/lib/visitor";

export function useVisitor() {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("en");

  useEffect(() => {
    let cancelled = false;

    async function register() {
      const existingId = getStoredVisitorId() ?? undefined;
      const detectedLanguage = detectBrowserLanguage();

      try {
        const visitor = await api.registerVisitor({
          visitorId: existingId,
          language: detectedLanguage,
        });
        if (cancelled) return;
        setStoredVisitorId(visitor.id);
        setVisitorId(visitor.id);
        setLanguage(visitor.language ?? detectedLanguage);
      } catch {
        // Backend unreachable — fall back to a locally generated id so the UI
        // still renders; chat requests will simply fail until the API is up.
        const fallbackId = existingId ?? uuidv4();
        if (cancelled) return;
        setStoredVisitorId(fallbackId);
        setVisitorId(fallbackId);
        setLanguage(detectedLanguage);
      }
    }

    void register();
    return () => {
      cancelled = true;
    };
  }, []);

  return { visitorId, language };
}

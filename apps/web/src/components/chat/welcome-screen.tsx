"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const FALLBACK_QUESTIONS = [
  "What is the difference between term insurance and whole life insurance?",
  "What tax benefits do I get under Section 80C and 80D?",
  "How do I file a health insurance claim?",
  "What does IRDAI regulate for life insurance companies?",
];

export function WelcomeScreen({ onSuggestedQuestion }: { onSuggestedQuestion: (q: string) => void }) {
  const { data } = useQuery({
    queryKey: ["suggested-questions"],
    queryFn: () => api.getSuggestedQuestions(),
    staleTime: Infinity,
    retry: false,
  });

  const questions = data?.questions ?? FALLBACK_QUESTIONS;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <ShieldCheck className="h-8 w-8" />
      </motion.div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Sabse Pehle Life Insurance AI Assistant</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Ask me about life insurance, health insurance, claims, premiums, tax benefits, riders, or
          IRDAI regulations — in any language.
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {questions.slice(0, 4).map((question) => (
          <Button
            key={question}
            variant="outline"
            className="h-auto whitespace-normal rounded-xl px-4 py-3 text-left text-xs font-normal leading-snug"
            onClick={() => onSuggestedQuestion(question)}
          >
            <Sparkles className="mr-2 h-3.5 w-3.5 shrink-0 text-primary" />
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}

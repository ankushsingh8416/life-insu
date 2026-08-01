"use client";

import * as React from "react";
import { ChatMessage } from "@sabsepehle/shared-types";
import { MessageBubble } from "./message-bubble";
import { WelcomeScreen } from "./welcome-screen";

const NEAR_BOTTOM_THRESHOLD = 120;

interface MessageListProps {
  messages: ChatMessage[];
  onRegenerate: (messageId: string) => void;
  onSuggestedQuestion: (question: string) => void;
}

export function MessageList({ messages, onRegenerate, onSuggestedQuestion }: MessageListProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const shouldAutoScroll = React.useRef(true);

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScroll.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  }, []);

  React.useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  if (messages.length === 0) {
    return <WelcomeScreen onSuggestedQuestion={onSuggestedQuestion} />;
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="scrollbar-thin h-full overflow-y-auto">
      <div className="flex flex-col gap-5 px-4 py-6 md:px-8">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onRegenerate={onRegenerate} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

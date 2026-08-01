"use client";

import { WifiOff } from "lucide-react";
import { useVisitor } from "@/hooks/use-visitor";
import { useChatSession } from "@/hooks/use-chat-session";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { Composer } from "./composer";

export function ChatWindow({ sharedSessionId }: { sharedSessionId?: string }) {
  const { visitorId, language } = useVisitor();
  const { sessionId, error, startNewChat, retry } = useChatSession(
    visitorId,
    language,
    sharedSessionId,
  );
  const { messages, connectionStatus, isGenerating, sendMessage, regenerate, clear } = useChat(
    sessionId,
    visitorId,
  );

  const handleClear = async () => {
    clear();
    await startNewChat();
  };

  return (
    <div className="flex h-dvh flex-col bg-gradient-to-b from-background to-muted/30">
      <ChatHeader sessionId={sessionId} messages={messages} onClear={handleClear} />

      <main className="min-h-0 flex-1">
        {error && !sessionId ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <WifiOff className="h-8 w-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <MessageList messages={messages} onRegenerate={regenerate} onSuggestedQuestion={sendMessage} />
        )}
      </main>

      <Composer
        onSend={sendMessage}
        disabled={!sessionId || !visitorId || isGenerating}
        connectionStatus={connectionStatus}
      />
    </div>
  );
}

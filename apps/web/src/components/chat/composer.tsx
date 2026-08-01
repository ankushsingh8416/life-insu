"use client";

import * as React from "react";
import { SendHorizonal } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 4000;

interface ComposerProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected";
}

export function Composer({ onSend, disabled, connectionStatus }: ComposerProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  React.useEffect(resize, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:px-8">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Ask about life insurance, claims, premiums, tax benefits..."
          rows={1}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          className="max-h-40 rounded-xl"
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          onClick={handleSend}
          disabled={disabled || value.trim().length === 0}
          aria-label="Send message"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>Sabse Pehle AI can make mistakes. Verify important details with your policy documents.</span>
        <span className={cn("flex items-center gap-1", connectionStatus !== "connected" && "text-amber-600")}>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connectionStatus === "connected" ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
          {connectionStatus === "connected" ? "Live" : connectionStatus === "connecting" ? "Connecting…" : "Reconnecting…"}
        </span>
      </div>
    </div>
  );
}

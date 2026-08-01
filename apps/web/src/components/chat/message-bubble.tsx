"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Bot, Copy, RotateCcw, ThumbsDown, ThumbsUp, TriangleAlert, User } from "lucide-react";
import { toast } from "sonner";
import { ChatMessage, FeedbackRating, MessageStatus } from "@sabsepehle/shared-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MarkdownRenderer } from "./markdown-renderer";
import { CitationList } from "./citation-list";
import { TypingIndicator } from "./typing-indicator";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  onRegenerate: (messageId: string) => void;
}

export function MessageBubble({ message, onRegenerate }: MessageBubbleProps) {
  const [feedback, setFeedback] = React.useState<FeedbackRating | null>(null);
  const isUser = message.role === "user";
  const isStreaming = message.status === MessageStatus.STREAMING;
  const isError = message.status === MessageStatus.ERROR;
  const isRejected = message.status === MessageStatus.REJECTED_OUT_OF_DOMAIN;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    toast.success("Copied to clipboard");
  };

  const handleFeedback = async (rating: FeedbackRating) => {
    const next = feedback === rating ? null : rating;
    setFeedback(next);
    if (!next) return;
    try {
      await api.submitFeedback({ messageId: message.id, rating: next });
      trackEvent("feedback_submitted", { messageId: message.id, rating: next });
      toast.success(rating === FeedbackRating.LIKE ? "Thanks for the feedback!" : "Thanks — we'll use this to improve.");
    } catch {
      toast.error("Couldn't save feedback, please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex w-full gap-3", isUser && "flex-row-reverse")}
    >
      <Avatar className="mt-0.5 shrink-0">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-secondary"}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "glass rounded-tl-sm",
            isError && "border border-destructive/50",
          )}
        >
          {isStreaming && message.content.length === 0 ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}

          {isError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <TriangleAlert className="h-3.5 w-3.5" />
              Something went wrong generating this response.
            </div>
          )}

          {!isUser && !isStreaming && <CitationList citations={message.citations} />}
        </div>

        {!isUser && !isStreaming && message.content.length > 0 && (
          <div className="flex items-center gap-0.5 px-1 text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>

            {!isRejected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRegenerate(message.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", feedback === FeedbackRating.LIKE && "text-emerald-600")}
                  onClick={() => handleFeedback(FeedbackRating.LIKE)}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Good response</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", feedback === FeedbackRating.DISLIKE && "text-destructive")}
                  onClick={() => handleFeedback(FeedbackRating.DISLIKE)}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Poor response</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </motion.div>
  );
}

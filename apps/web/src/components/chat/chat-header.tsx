"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Download, Link2, Moon, ShieldCheck, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChatMessage } from "@sabsepehle/shared-types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { exportChatToPdf } from "@/lib/export-pdf";

interface ChatHeaderProps {
  sessionId: string | null;
  messages: ChatMessage[];
  onClear: () => void;
}

export function ChatHeader({ sessionId, messages, onClear }: ChatHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const handleShare = async () => {
    if (!sessionId) return;
    const url = `${window.location.origin}/c/${sessionId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Shareable link copied to clipboard");
  };

  const handleExport = async () => {
    if (messages.length === 0) {
      toast.info("Nothing to export yet");
      return;
    }
    await exportChatToPdf(messages);
  };

  const handleClear = () => {
    onClear();
    toast.success("Started a new conversation");
  };

  return (
    <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Sabse Pehle AI</p>
          <p className="text-[11px] leading-tight text-muted-foreground">Life &amp; Health Insurance Assistant</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleShare} disabled={!sessionId}>
              <Link2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share conversation</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export as PDF</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear chat</TooltipContent>
        </Tooltip>

        {mounted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}

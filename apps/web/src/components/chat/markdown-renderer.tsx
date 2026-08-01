"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Syntax highlighting is fairly heavy and only needed when a response actually
// contains a fenced code block — load it on demand rather than in the main bundle.
const CodeBlock = dynamic(() => import("./code-block").then((m) => m.CodeBlock), {
  ssr: false,
  loading: () => <div className="my-2 h-16 animate-pulse rounded-lg bg-muted" />,
});

export function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("markdown-body text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName ?? "");
            const isInline = !match;
            if (isInline) {
              return (
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match?.[1]} code={String(children).replace(/\n$/, "")} />;
          },
          a({ children, ...props }) {
            return (
              <a target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

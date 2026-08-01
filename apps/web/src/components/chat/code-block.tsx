"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";

export function CodeBlock({ language, code }: { language?: string; code: string }) {
  const { resolvedTheme } = useTheme();

  return (
    <SyntaxHighlighter
      language={language}
      style={resolvedTheme === "dark" ? oneDark : oneLight}
      PreTag="div"
      customStyle={{ margin: 0, borderRadius: "0.5rem", fontSize: "0.85em" }}
    >
      {code}
    </SyntaxHighlighter>
  );
}

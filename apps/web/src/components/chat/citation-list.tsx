import { ExternalLink, FileText } from "lucide-react";
import { Citation } from "@sabsepehle/shared-types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-2.5">
      <span className="w-full text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sources
      </span>
      {citations.map((citation, i) => (
        <Tooltip key={citation.chunkId}>
          <TooltipTrigger asChild>
            {citation.sourceUrl ? (
              <a
                href={citation.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <FileText className="h-3 w-3" />
                <span className="max-w-[10rem] truncate">{i + 1}. {citation.title}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span className="max-w-[10rem] truncate">{i + 1}. {citation.title}</span>
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="line-clamp-4">{citation.snippet}</p>
            <p className="mt-1 text-muted-foreground">Relevance: {Math.round(citation.score * 100)}%</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

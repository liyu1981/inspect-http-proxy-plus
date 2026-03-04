"use client";

import { Check, Copy, Sparkles, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { copyToClipboard } from "@/lib/curl-gen-util";
import { generateBatchLLMMarkdown } from "@/lib/llm-data-gen-util";

interface BulkSelectionBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BulkSelectionBar({
  selectedIds,
  onClearSelection,
}: BulkSelectionBarProps) {
  const [isCopying, setIsCopying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopyForLLM = async () => {
    if (selectedIds.length === 0) return;

    setIsCopying(true);
    try {
      // Fetch full details for all selected sessions
      const response = await api.post("/api/sessions/batch", {
        ids: selectedIds,
      });

      const sessions = response.data.sessions;
      const markdown = generateBatchLLMMarkdown(sessions);

      const success = await copyToClipboard(markdown);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error("Failed to copy batch sessions for LLM:", error);
    } finally {
      setIsCopying(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 border border-primary/20 backdrop-blur-sm bg-opacity-90">
        <div className="flex items-center gap-3 border-r border-primary-foreground/20 pr-6">
          <div className="bg-primary-foreground text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
            {selectedIds.length}
          </div>
          <span className="text-sm font-medium">Selected</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyForLLM}
            disabled={isCopying}
            className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full h-9 px-4 gap-2"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {copied ? "Copied!" : isCopying ? "Processing..." : "Copy for LLM"}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-full h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

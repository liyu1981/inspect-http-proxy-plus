"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { JsonEditor } from "@/app/_components/json-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BodyRenderer, BodyRendererProps } from "./types";

interface OllamaChunk {
  raw: string;
  json: any;
  content: string;
}

const OllamaStreamRendererComponent = ({ body }: BodyRendererProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const chunks = useMemo(() => {
    const lines = body.split("\n");
    const result: OllamaChunk[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const json = JSON.parse(trimmed);
        // Ollama response field is usually 'response' or 'message.content'
        const content = json.response || json.message?.content || "";

        result.push({
          raw: trimmed,
          json: json,
          content: content,
        });
      } catch (e) {
        // Skip invalid JSON
      }
    }
    return result;
  }, [body]);

  useEffect(() => {
    if (selectedIndex === null && chunks.length > 0) {
      setSelectedIndex(0);
    }
  }, [chunks, selectedIndex]);

  if (chunks.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground italic">
        No valid Ollama stream data found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Fragments View */}
      <div className="p-4 border-b overflow-y-auto max-h-[50%]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-bold uppercase tracking-wider border border-orange-500/20">
            Ollama Stream
          </span>
        </div>
        <div className="text-sm leading-relaxed font-sans">
          {chunks.map((chunk, index) => (
            <span
              key={`chunk-${index}`}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "cursor-pointer transition-colors duration-150 decoration-orange-500/30",
                "hover:bg-orange-500/10 hover:text-orange-600",
                selectedIndex === index
                  ? "bg-orange-500/20 text-orange-600 underline decoration-2 underline-offset-4"
                  : "underline decoration-1 underline-offset-2",
              )}
              title="Click to view JSON chunk"
            >
              {chunk.content || (
                <span className="text-[10px] opacity-30 mx-0.5 align-middle">
                  [meta]
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* JSON View */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {selectedIndex !== null ? (
          <div className="h-full flex flex-col">
            <div className="px-4 py-1.5 bg-muted/30 border-b flex justify-between items-center shrink-0">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Chunk #{selectedIndex + 1} Metadata
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={selectedIndex === 0}
                  onClick={() => setSelectedIndex(selectedIndex - 1)}
                  title="Previous chunk"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={selectedIndex === chunks.length - 1}
                  onClick={() => setSelectedIndex(selectedIndex + 1)}
                  title="Next chunk"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <JsonEditor
                initialJson={chunks[selectedIndex].json}
                rootFontSize={"12px"}
                viewOnly={true}
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
            Select a fragment above to inspect its raw JSON data
          </div>
        )}
      </div>
    </div>
  );
};

export const ollamaStreamRenderer: BodyRenderer = {
  id: "ollama-stream",
  label: "Ollama Stream",
  priority: 110,
  match: (contentType: string, body: string) => {
    // Strictly require application/x-ndjson for Ollama streams
    const isNDJSON = contentType?.includes("application/x-ndjson");
    if (!isNDJSON) return false;

    // Additionally verify it looks like an Ollama stream
    return (
      body.trim().startsWith('{"model":') && body.includes('"created_at":')
    );
  },
  component: OllamaStreamRendererComponent,
};

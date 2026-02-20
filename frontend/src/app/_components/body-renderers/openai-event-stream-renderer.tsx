"use client";

import { useEffect, useMemo, useState } from "react";
import { JsonEditor } from "@/app/_components/json-editor";
import { cn } from "@/lib/utils";
import type { BodyRenderer, BodyRendererProps } from "./types";

interface StreamChunk {
  raw: string;
  json: any;
  content: string;
}

const OpenAiEventStreamRendererComponent = ({ body }: BodyRendererProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const chunks = useMemo(() => {
    const lines = body.split("\n");
    const result: StreamChunk[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const rawData = trimmed.slice(6);
      if (rawData === "[DONE]") continue;

      try {
        const json = JSON.parse(rawData);
        const content =
          json.choices?.[0]?.delta?.content || json.choices?.[0]?.text || "";
        // Even if content is empty (like role: assistant chunks), we keep the chunk for JSON inspection
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
        No valid OpenAI stream data found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Fragments View */}
      <div className="p-4 border-b overflow-y-auto max-h-[50%]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase tracking-wider border border-primary/20">
            OpenAI Text Stream
          </span>
        </div>
        <div className="text-sm leading-relaxed font-sans">
          {chunks.map((chunk, index) => (
            <span
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "cursor-pointer transition-colors duration-150 decoration-primary/30",
                "hover:bg-primary/10 hover:text-primary",
                selectedIndex === index
                  ? "bg-primary/20 text-primary underline decoration-2 underline-offset-4"
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
            <div className="px-4 py-2 bg-muted/30 border-b flex justify-between items-center shrink-0">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Chunk #{selectedIndex + 1} Metadata
              </span>
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

export const openAiEventStreamRenderer: BodyRenderer = {
  id: "openai-event-stream",
  label: "OpenAI Stream",
  priority: 110, // Higher than general text
  match: (contentType: string, body: string) => {
    const isSSE = contentType?.includes("text/event-stream");
    // Regex matches common OpenAI SSE patterns: data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":...}
    const hasOpenAiPattern =
      /data: \{.*"choices":\[.*\]\}/.test(body) ||
      /data: \{.*"object":"chat.completion.chunk"/.test(body);

    return isSSE && hasOpenAiPattern;
  },
  component: OpenAiEventStreamRendererComponent,
};

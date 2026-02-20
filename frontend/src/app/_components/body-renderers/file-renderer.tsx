"use client";

import { FileIcon } from "lucide-react";
import React from "react";
import type { BodyRenderer, BodyRendererProps } from "./types";

const FileRenderer: React.FC<BodyRendererProps> = ({ body, contentType }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[150px] w-full bg-muted/30 rounded-md border border-dashed">
      <div className="p-4 rounded-full bg-primary/10 mb-4">
        <FileIcon className="h-10 w-10 text-primary" />
      </div>
      <div className="text-center">
        <h4 className="font-semibold text-sm mb-1">Binary File</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Content Type: {contentType}
        </p>
      </div>
      <div className="text-[10px] text-muted-foreground font-mono bg-background/50 p-2 rounded border max-w-full overflow-hidden truncate">
        {body.slice(0, 100)}
        {body.length > 100 ? "..." : ""}
      </div>
    </div>
  );
};

export const fileRenderer: BodyRenderer = {
  id: "file",
  label: "File",
  priority: -1, // Lowest priority, matches everything as fallback if needed, or matched specifically
  match: (contentType: string) => {
    const isBinary =
      contentType.startsWith("application/octet-stream") ||
      contentType.startsWith("application/pdf") ||
      contentType.startsWith("application/vnd.ms-excel") ||
      contentType.startsWith("application/msword") ||
      contentType.startsWith("application/vnd.openxmlformats-officedocument.");
    return isBinary;
  },
  component: FileRenderer as any,
};

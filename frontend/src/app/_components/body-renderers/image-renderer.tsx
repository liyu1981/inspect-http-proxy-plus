"use client";

import React from "react";
import type { BodyRenderer, BodyRendererProps } from "./types";

const ImageRenderer: React.FC<BodyRendererProps> = ({ body, contentType }) => {
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(body.trim());
  const src = isBase64
    ? `data:${contentType};base64,${body}`
    : `data:${contentType};base64,${btoa(body)}`;

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[200px] w-full bg-muted/30">
      <div className="relative group max-w-full overflow-hidden rounded-md shadow-sm border bg-card">
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
        <img
          src={src}
          alt="Response Preview"
          className="max-w-full h-auto object-contain cursor-zoom-in"
          onClick={() => window.open(src, "_blank")}
        />
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Click to view full size
        </div>
      </div>
      <div className="mt-4 text-xs text-muted-foreground font-mono">
        Image Type: {contentType}
      </div>
    </div>
  );
};

export const imageRenderer: BodyRenderer = {
  id: "image",
  label: "Image",
  priority: 10,
  match: (contentType: string) => contentType.startsWith("image/"),
  component: ImageRenderer as any,
};

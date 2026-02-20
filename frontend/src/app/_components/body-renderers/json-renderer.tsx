"use client";

import { JsonEditor } from "@/app/_components/json-editor";
import type { BodyRenderer, BodyRendererProps } from "./types";

const JsonRendererComponent = ({ body }: BodyRendererProps) => {
  let json: object = {};
  try {
    // 1. Try direct parse (original behavior)
    json = JSON.parse(body);
  } catch (_e) {
    // 2. Try base64 decoding if not direct JSON
    try {
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoded = new TextDecoder().decode(bytes);
      json = JSON.parse(decoded);
    } catch (_e2) {
      // If still not valid JSON, we could show an error or fallback to pre
      return (
        <div className="p-4 text-xs text-red-500 font-mono italic">
          Invalid JSON data
        </div>
      );
    }
  }
  return (
    <JsonEditor initialJson={json} rootFontSize={"13px"} viewOnly={true} />
  );
};

export const jsonRenderer: BodyRenderer = {
  id: "json",
  label: "JSON",
  priority: 100,
  match: (contentType: string) => contentType?.includes("application/json"),
  component: JsonRendererComponent,
};

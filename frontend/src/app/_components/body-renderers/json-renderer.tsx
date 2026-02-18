"use client";

import { JsonEditor } from "@/app/_components/json-editor";
import type { BodyRenderer, BodyRendererProps } from "./types";

const JsonRendererComponent = ({ body }: BodyRendererProps) => {
  let json: object = {};
  try {
    json = JSON.parse(body);
  } catch (_e) {
    // If not valid JSON, we could show an error or fallback to pre
    return (
      <div className="p-4 text-xs text-red-500 font-mono italic">
        Invalid JSON data
      </div>
    );
  }
  return <JsonEditor initialJson={json} rootFontSize={"13px"} viewOnly={true} />;
};

export const jsonRenderer: BodyRenderer = {
  id: "json",
  label: "JSON",
  priority: 100,
  match: (contentType: string) => contentType?.includes("application/json"),
  component: JsonRendererComponent,
};

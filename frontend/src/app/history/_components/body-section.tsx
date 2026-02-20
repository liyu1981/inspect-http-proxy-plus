import { useState } from "react";
import { findRenderer } from "@/app/_components/body-renderers/registry";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface BodySectionProps {
  title: string;
  body: string;
  size: number;
  type: string;
}

export function BodySection({ title, body, size, type }: BodySectionProps) {
  const [isRaw, setIsRaw] = useState(false);

  if (!size || size === 0)
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <div className="p-4 rounded-md border border-dashed text-center text-muted-foreground text-sm">
          No body content ({size} bytes)
        </div>
      </div>
    );

  // For some types (images, zip), we prefer to pass the raw (potentially base64) body
  // to the renderer instead of trying to decode it here, which might mangle binary data.
  const isBinaryType =
    type.startsWith("image/") ||
    type.includes("zip") ||
    type.includes("application/octet-stream");

  let content = body;
  let isBase64Decoded = false;

  if (!isBinaryType) {
    try {
      if (typeof body === "string") {
        const decoded = atob(body);
        content = decoded;
        isBase64Decoded = true;
      }
    } catch (_e) {
      // Not base64 or failed
    }
  }

  const renderer = findRenderer(type, content);
  let contentEl = <div></div>;

  if (renderer && !isRaw) {
    const Component = renderer.component;
    contentEl = <Component body={content} contentType={type} />;
  } else {
    contentEl = (
      <pre className="flex-1 text-xs p-4 font-mono whitespace-pre-wrap break-all">
        {content}
      </pre>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {renderer && (
            <div className="flex items-center gap-2">
              <Label
                htmlFor="raw-mode"
                className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer"
              >
                Raw Mode ({renderer.label})
              </Label>
              <Switch
                id="raw-mode"
                checked={isRaw}
                onCheckedChange={setIsRaw}
                size="sm"
              />
            </div>
          )}
          <div className="flex gap-2">
            <span>{size} bytes</span>
            <span>{type}</span>
            {isBase64Decoded && (
              <Badge variant="outline" className="text-[10px]">
                Base64 Decoded
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-md border bg-muted/50 overflow-auto flex-1 min-h-0">
        {contentEl}
      </div>
    </div>
  );
}

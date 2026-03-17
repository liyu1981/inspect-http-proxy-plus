import { useEffect, useState } from "react";
import {
  AdaptiveBodyRenderer,
  findRenderer,
} from "@/app/_components/body-renderers/registry";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { decompressGzip } from "@/lib/zip-util";

interface BodySectionProps {
  title: string;
  body: string;
  size: number;
  type: string;
  encoding?: string;
}

export function BodySection({
  title,
  body,
  size,
  type,
  encoding,
}: BodySectionProps) {
  const [isRaw, setIsRaw] = useState(false);
  const [decompressed, setDecompressed] = useState<string | null>(null);

  useEffect(() => {
    if (encoding === "gzip") {
      const binary = atob(body);
      const buffer = Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
      decompressGzip(buffer)
        .then(setDecompressed)
        .catch(() => setDecompressed(body));
    } else {
      setDecompressed(null);
    }
  }, [body, encoding]);

  if (!size || size === 0)
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <div className="p-4 rounded-md border border-dashed text-center text-muted-foreground text-sm">
          No body content ({size} bytes)
        </div>
      </div>
    );

  const { content, isBase64Decoded, isGzipDecoded } = (() => {
    if (encoding === "gzip") {
      return {
        content: decompressed ?? body,
        isBase64Decoded: false,
        isGzipDecoded: decompressed !== null,
      };
    }

    const isBinaryType =
      type.startsWith("image/") ||
      type.includes("zip") ||
      type.includes("application/octet-stream");

    if (isBinaryType || typeof body !== "string")
      return { content: body, isBase64Decoded: false, isGzipDecoded: false };

    try {
      return {
        content: atob(body),
        isBase64Decoded: true,
        isGzipDecoded: false,
      };
    } catch {
      return { content: body, isBase64Decoded: false, isGzipDecoded: false };
    }
  })();

  const renderer = findRenderer(type, content);
  let contentEl = <div></div>;

  if (renderer && !isRaw) {
    contentEl = (
      <AdaptiveBodyRenderer body={content} contentType={renderer.id} />
    );
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
            {isGzipDecoded && (
              <Badge variant="outline" className="text-[10px]">
                Gzip Decoded
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-md border bg-muted/50 overflow-auto flex-1 min-h-0">
        {encoding === "gzip" && decompressed === null ? (
          <pre className="flex-1 text-xs p-4 font-mono text-muted-foreground">
            Decompressing…
          </pre>
        ) : (
          contentEl
        )}
      </div>
    </div>
  );
}

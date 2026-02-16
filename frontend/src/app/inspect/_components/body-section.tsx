import { JsonEditor } from "@/app/_components/json-editor";
import { Badge } from "@/components/ui/badge";

interface BodySectionProps {
  title: string;
  body: string;
  size: number;
  type: string;
}

export function BodySection({ title, body, size, type }: BodySectionProps) {
  if (!size || size === 0)
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <div className="p-4 rounded-md border border-dashed text-center text-muted-foreground text-sm">
          No body content ({size} bytes)
        </div>
      </div>
    );

  let content = body;
  let contentEl = <div></div>;
  let isBase64 = false;

  try {
    if (typeof body === "string") {
      const decoded = atob(body);
      // Check if decoded looks like text (no non-printable chars ideally, but simple check)
      content = decoded;
      isBase64 = true;
    }
  } catch (_e) {
    // Not base64 or failed
  }

  if (type?.includes("application/json")) {
    let json: object = {};
    try {
      json = JSON.parse(content);
    } catch (_e) {
      // Not valid json
    }
    contentEl = (
      <JsonEditor initialJson={json} rootFontSize={"13px"} viewOnly={true} />
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
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{size} bytes</span>
          <span>{type}</span>
          {isBase64 && (
            <Badge variant="outline" className="text-[10px]">
              Base64 Decoded
            </Badge>
          )}
        </div>
      </div>
      <div className="rounded-md border bg-muted/50 overflow-auto flex-1 min-h-0">
        {contentEl}
      </div>
    </div>
  );
}

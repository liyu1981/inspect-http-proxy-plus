"use client";

import { format } from "date-fns";
import { useAtomValue, useSetAtom } from "jotai";
import {
  Activity,
  AlertCircle,
  Copy,
  Download,
  FileText,
  List,
  Logs,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getResponseStateAtom, responseStateAtom } from "../_jotai/http-res";
import { findRenderer } from "./body-renderers/registry";

export interface HttpResponseViewerProps {
  responseHashKey: string;
}

export function HttpResponseViewer({
  responseHashKey,
}: HttpResponseViewerProps) {
  const getResponseState = useSetAtom(getResponseStateAtom);
  const stateAtom = useMemo(
    () => responseStateAtom(responseHashKey),
    [responseHashKey],
  );
  const state = useAtomValue(stateAtom);
  const [isRaw, setIsRaw] = useState(false);

  useEffect(() => {
    getResponseState(responseHashKey);
  }, [responseHashKey, getResponseState]);

  const { data: response, error, loading, request } = state;

  const contentType = response?.headers["content-type"] || "text/plain";
  const body = response?.body || "";

  // The body in the API response is now a byte slice, which is base64 encoded in JSON.
  // For display as text, we need to decode it if it looks like base64.
  const displayBody = useMemo(() => {
    if (!body) return "";

    const isTextLike =
      contentType.startsWith("text/") ||
      contentType.includes("json") ||
      contentType.includes("javascript") ||
      contentType.includes("xml") ||
      contentType.includes("html");

    if (isTextLike) {
      try {
        // Simple base64 detection
        if (/^[A-Za-z0-9+/=]+$/.test(body.trim())) {
          const binary = atob(body);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return new TextDecoder().decode(bytes);
        }
      } catch (_e) {
        // Fallback to raw if decoding fails
      }
    }
    return body;
  }, [body, contentType]);

  const copyResponse = () => {
    if (displayBody) navigator.clipboard.writeText(displayBody);
  };

  const downloadResponse = () => {
    if (body) {
      // If it looks like base64, we should decode it for download if we want the actual file
      const isBase64 =
        /^[A-Za-z0-9+/=]+$/.test(body.trim()) && body.length > 20;
      let blob: Blob;
      if (isBase64) {
        try {
          const byteCharacters = atob(body);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: contentType });
        } catch (_e) {
          blob = new Blob([body], { type: "text/plain" });
        }
      } else {
        blob = new Blob([body], { type: contentType });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `response-${responseHashKey.slice(0, 6)}.${getFileExtension(contentType)}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const renderer = findRenderer(contentType, body);

  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <div className="flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="font-bold flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-primary" />
            Result: {responseHashKey.slice(0, 8)}
          </div>
          {request && (
            <div className="text-[10px] text-muted-foreground p-0 m-0 px-6">
              <span className="font-bold text-primary mr-2">
                {request.method}
              </span>
              <span className="font-mono">{request.url}</span>
            </div>
          )}
        </div>

        {response && (
          <div className="flex items-center gap-1 bg-background p-1 shrink-0">
            {renderer && (
              <div className="flex items-center gap-2 mr-4 px-2 border-r">
                <Label
                  htmlFor="raw-mode-viewer"
                  className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer"
                >
                  Raw
                </Label>
                <Switch
                  id="raw-mode-viewer"
                  checked={isRaw}
                  onCheckedChange={setIsRaw}
                  className="scale-75"
                />
              </div>
            )}
            <Button
              onClick={copyResponse}
              variant="ghost"
              size="sm"
              className="h-8 px-2"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Button
              onClick={downloadResponse}
              variant="ghost"
              size="sm"
              className="h-8 px-2"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex-1 min-h-0 flex flex-col rounded-md mx-2 border-none",
          loading && !response ? "animate-pulse" : "",
        )}
      >
        <Tabs defaultValue="body" className="flex flex-col h-full">
          <TabsList className="w-full justify-start rounded-none border-b-none bg-muted/20 px-4">
            {[
              { value: "body", label: "Response Body", icon: Logs },
              { value: "status", label: "Status", icon: Activity },
              { value: "headers", label: "Response Headers", icon: List },
              { value: "request", label: "Request Details", icon: FileText },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "rounded-none h-full px-4 text-xs font-medium transition-all border-none shadow-none flex items-center gap-2",
                  "hover:bg-muted/40 hover:text-foreground",
                  "data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none",
                )}
              >
                {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Response Body */}
          <TabsContent
            value="body"
            className="flex-1 m-0 data-[state=active]:flex overflow-hidden"
          >
            <div className="w-full h-full bg-muted/10 rounded-sm overflow-auto">
              {loading && !response ? (
                <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse italic text-sm">
                  Waiting for data...
                </div>
              ) : !body ? (
                <div className="flex items-center justify-center h-full text-muted-foreground italic text-sm">
                  No response body
                </div>
              ) : renderer && !isRaw ? (
                <renderer.component body={body} contentType={contentType} />
              ) : (
                <pre className="p-4 font-mono text-xs whitespace-pre-wrap break-all">
                  {displayBody}
                </pre>
              )}
            </div>
          </TabsContent>

          <TabsContent value="status" className="m-0 border-none outline-none">
            <div className="flex-shrink-0 p-4">
              <div className="rounded-md border overflow-hidden bg-card">
                <div className="grid grid-cols-3 bg-muted/30 border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="px-4 py-2 border-r">Status</div>
                  <div className="px-4 py-2 border-r">Time</div>
                  <div className="px-4 py-2">Connection</div>
                </div>
                <div className="grid grid-cols-3 text-sm font-mono">
                  <div className="px-4 py-3 border-r flex items-center">
                    {error ? (
                      <span className="text-red-500 flex items-center gap-1.5 font-bold">
                        <AlertCircle className="h-3.5 w-3.5" /> ERROR
                      </span>
                    ) : response ? (
                      <span
                        className={cn(
                          "font-bold",
                          response.status < 300
                            ? "text-green-600"
                            : "text-yellow-600",
                        )}
                      >
                        {response.status} {response.statusText}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">
                        Pending...
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-3 border-r text-muted-foreground">
                    {response ? `${response.duration}ms` : "--"}
                  </div>
                  <div className="px-4 py-3 flex items-center gap-2">
                    <ShieldCheck
                      className={cn(
                        "h-4 w-4",
                        request?.url.startsWith("https")
                          ? "text-green-500"
                          : "text-yellow-500",
                      )}
                    />
                    <span className="text-xs">
                      {request?.url.split(":")[0].toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              {error && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-mono">
                  <strong>Execution Error:</strong> {error}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="headers" className="flex-1 overflow-auto p-4 m-0">
            <div className="space-y-1 border rounded-md">
              {response ? (
                Object.entries(response.headers).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex gap-4 p-2 border-b last:border-0 hover:bg-muted/30 transition-colors text-xs"
                  >
                    <span className="font-mono font-bold min-w-[160px] text-primary">
                      {key}:
                    </span>
                    <span className="font-mono text-muted-foreground break-all">
                      {value}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No headers available
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="request"
            className="flex-1 overflow-auto p-4 m-0 space-y-4"
          >
            {request && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                    Endpoint
                  </Label>
                  <div className="p-2 bg-muted/30 rounded border font-mono text-xs break-all">
                    <span className="text-primary font-bold mr-2">
                      {request.method}
                    </span>
                    {request.url}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                    Request Headers
                  </Label>
                  <div className="border rounded divide-y">
                    {request.headers
                      .filter((h) => h.enabled && h.key)
                      .map((h) => (
                        <div
                          key={`header-${h.key}`}
                          className="grid grid-cols-3 p-2 text-xs font-mono"
                        >
                          <span className="font-bold border-r pr-2">
                            {h.key}
                          </span>
                          <span
                            className="col-span-2 pl-3 text-muted-foreground truncate"
                            title={h.value}
                          >
                            {h.value}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {request.body && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Payload
                    </Label>
                    <pre className="p-3 bg-muted/30 rounded border text-[11px] font-mono overflow-auto max-h-[150px]">
                      {request.body}
                    </pre>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function getFileExtension(contentType: string): string {
  if (contentType.includes("json")) return "json";
  if (contentType.includes("html")) return "html";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("zip")) return "zip";
  if (contentType.includes("pdf")) return "pdf";
  return "txt";
}

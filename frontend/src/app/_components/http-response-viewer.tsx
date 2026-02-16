"use client";

import { format } from "date-fns";
import { useAtomValue, useSetAtom } from "jotai";
import {
  Activity,
  AlertCircle,
  Copy,
  Download,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getResponseStateAtom, responseStateAtom } from "../_jotai/http-res";

export interface HttpResponseViewerProps {
  responseHashKey: string;
}

export function HttpResponseViewer({
  responseHashKey,
}: HttpResponseViewerProps) {
  const getResponseState = useSetAtom(getResponseStateAtom);
  // Use useMemo to create the atom only when responseHashKey changes
  const stateAtom = useMemo(
    () => responseStateAtom(responseHashKey),
    [responseHashKey],
  );
  const state = useAtomValue(stateAtom);

  useEffect(() => {
    // Ensure it's loaded into the atom if it exists in IndexedDB but not in memory
    getResponseState(responseHashKey);
  }, [responseHashKey, getResponseState]);

  const { data: response, error, loading, request } = state;

  const copyResponse = () => {
    if (response?.body) navigator.clipboard.writeText(response.body);
  };

  const downloadResponse = () => {
    if (response?.body) {
      const blob = new Blob([response.body], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `response-${responseHashKey.slice(0, 6)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <div className="flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Result Of Request: {responseHashKey}
          </div>
          {request && (
            <div className="text-sm p-0 m-0 px-6">
              <div className="grid grid-cols-3 gap-2">
                <div className="font-medium">Request Time</div>
                <div className="col-span-2 font-mono break-all">
                  {format(new Date(request.timestamp), "PP pp")}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="font-medium">{request.method}</div>
                <div className="col-span-2 font-mono">{request.url}</div>
              </div>
            </div>
          )}
        </div>

        {response && (
          <div className="flex items-center gap-1 bg-background p-1 shrink-0">
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
        <Tabs defaultValue="status" className="flex flex-col h-full">
          <TabsList className="w-full justify-start rounded-none border-b-none bg-muted/20 px-4">
            {[
              { value: "status", label: "Status" },
              { value: "body", label: "Response Body" },
              { value: "headers", label: "Response Headers" },
              { value: "request", label: "Request Details" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "rounded-none h-full px-4 text-xs font-medium transition-all border-none shadow-none",
                  // Hover State: Medium Dark
                  "hover:bg-muted/40 hover:text-foreground",
                  // Active State: Deep Dark
                  "data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none",
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

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
                      <span className="text-muted-foreground italic">
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

          {/* Response Body */}
          <TabsContent
            value="body"
            className="flex-1 px-4 m-0 data-[state=active]:flex overflow-hidden"
          >
            <Textarea
              value={response?.body || ""}
              readOnly
              placeholder={loading ? "Waiting for data..." : "No response body"}
              className="font-mono text-sm bg-muted/10 w-full h-full resize-none focus-visible:ring-0 rounded-sm p-4"
            />
          </TabsContent>

          {/* Response Headers */}
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

          {/* Detailed Request View (Snapshotted) */}
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

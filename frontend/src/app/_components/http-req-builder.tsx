"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FileText, Loader2, Plus, Send, X } from "lucide-react"; // Added Zap/Globe for tab icons
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { addTabAtom } from "../_jotai/bottom-panel-store";
// Jotai Atoms
import {
  addHeaderAtom,
  removeHeaderAtom,
  requestAtom,
  requestBodyAtom,
  requestHeadersAtom,
  requestMethodAtom,
  requestTimestampAtom,
  requestUrlAtom,
  updateHeaderAtom,
} from "../_jotai/http-req";
import {
  calculateRequestHash,
  updateResponseStateAtom,
} from "../_jotai/http-res";
import { HttpResponseViewer } from "./http-response-viewer";
import { JsonEditor } from "./json-editor";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export default function HttpReqBuilder() {
  // Request State
  const currentRequest = useAtomValue(requestAtom);
  const [method, setMethod] = useAtom(requestMethodAtom);
  const [url, setUrl] = useAtom(requestUrlAtom);
  const [body, setBody] = useAtom(requestBodyAtom);
  const headers = useAtomValue(requestHeadersAtom);

  // Actions
  const addHeader = useSetAtom(addHeaderAtom);
  const updateHeader = useSetAtom(updateHeaderAtom);
  const removeHeader = useSetAtom(removeHeaderAtom);
  const addTab = useSetAtom(addTabAtom);
  const updateResponseState = useSetAtom(updateResponseStateAtom);
  const updateTimestamp = useSetAtom(requestTimestampAtom);

  const [isCalculating, setIsCalculating] = useState(false);

  const sendRequest = async () => {
    if (!url) return;
    setIsCalculating(true);

    updateTimestamp(Date.now()); // Update timestamp to ensure hash changes on each send

    try {
      // 1. Generate unique hash for this specific request configuration
      const hash = await calculateRequestHash(currentRequest);

      // 2. Open (or focus) a tab for this specific response
      // We pass the hash to the viewer so it knows which data to pull from the map
      addTab({
        newTab: {
          label: `${method} ${url.replace(/^https?:\/\//, "")}`,
          icon: FileText,
          content: <HttpResponseViewer responseHashKey={hash} />,
          closeable: true,
        },
      });

      // 3. Set loading state in the global response map
      updateResponseState({
        hash,
        state: { loading: true, error: null, request: { ...currentRequest } },
      });

      // 4. Prepare Payload
      const enabledHeaders = headers
        .filter((h) => h.enabled && h.key.trim())
        // biome-ignore lint/performance/noAccumulatingSpread: skip
        .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});

      let requestBody = body || "";
      if (requestBody.trim()) {
        try {
          // Normalize JSON if applicable
          requestBody = JSON.stringify(JSON.parse(requestBody));
        } catch (_e) {
          /* send raw */
        }
      }

      // 5. Execute
      const res = await api.post("/api/httpreq", {
        method,
        url,
        headers: enabledHeaders,
        body: requestBody,
      });

      // 6. Update the map with the successful result
      updateResponseState({
        hash,
        state: {
          loading: false,
          data: {
            status: res.data.status,
            statusText: res.data.statusText,
            headers: res.data.headers,
            body: res.data.body,
            duration: res.data.duration,
          },
        },
      });
      // biome-ignore lint/suspicious/noExplicitAny: error
    } catch (err: any) {
      const hash = await calculateRequestHash(currentRequest);
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to send request";

      updateResponseState({
        hash,
        state: { loading: false, error: errorMessage },
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 grid grid-cols-2 gap-4 p-0 overflow-auto">
          <div className="flex flex-col space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Request</Label>
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background font-mono text-sm font-medium min-w-[120px]"
                >
                  {HTTP_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                  className="flex-1 font-mono text-sm"
                />
              </div>
              <Button
                onClick={sendRequest}
                disabled={isCalculating || !url}
                className="w-full"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Request
                  </>
                )}
              </Button>
            </div>

            {/* Headers Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Headers</Label>
                <Button
                  onClick={() => addHeader()}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Header
                </Button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-auto border rounded-md p-3 bg-muted/20">
                {headers.map((header) => (
                  <div key={header.id} className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) =>
                        updateHeader({
                          id: header.id,
                          field: "enabled",
                          value: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <Input
                      value={header.key}
                      onChange={(e) =>
                        updateHeader({
                          id: header.id,
                          field: "key",
                          value: e.target.value,
                        })
                      }
                      placeholder="Key"
                      className="flex-1 font-mono text-sm h-9"
                    />
                    <Input
                      value={header.value}
                      onChange={(e) =>
                        updateHeader({
                          id: header.id,
                          field: "value",
                          value: e.target.value,
                        })
                      }
                      placeholder="Value"
                      className="flex-1 font-mono text-sm h-9"
                    />
                    <Button
                      onClick={() => removeHeader(header.id)}
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Body Section */}
          <div className="flex flex-col min-h-0">
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <Label className="text-sm font-medium">Body</Label>
              <div className="flex-1 relative bg-muted/50 rounded-md border overflow-hidden min-h-[200px]">
                <JsonEditor
                  key={body}
                  initialJson={body ? JSON.parse(body) : {}}
                  rootFontSize={"13px"}
                  onChangeJson={(newJson) => setBody(newJson)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

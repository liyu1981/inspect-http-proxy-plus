"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FileIcon, Loader2, Logs, Plus, Send, X } from "lucide-react"; // Added Zap/Globe for tab icons
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { addTabAtom } from "../_jotai/bottom-panel-store";
// Jotai Atoms
import {
  addFormDataEntryAtom,
  addHeaderAtom,
  removeFormDataEntryAtom,
  removeHeaderAtom,
  requestAtom,
  requestBodyAtom,
  requestBodyTypeAtom,
  requestFormDataEntriesAtom,
  requestHeadersAtom,
  requestMethodAtom,
  requestTimestampAtom,
  requestUrlAtom,
  updateFormDataEntryAtom,
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
  const [bodyType, setBodyType] = useAtom(requestBodyTypeAtom);
  const formDataEntries = useAtomValue(requestFormDataEntriesAtom);
  const headers = useAtomValue(requestHeadersAtom);

  // Actions
  const addHeader = useSetAtom(addHeaderAtom);
  const updateHeader = useSetAtom(updateHeaderAtom);
  const removeHeader = useSetAtom(removeHeaderAtom);
  const addFormDataEntry = useSetAtom(addFormDataEntryAtom);
  const updateFormDataEntry = useSetAtom(updateFormDataEntryAtom);
  const removeFormDataEntry = useSetAtom(removeFormDataEntryAtom);
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
          icon: Logs,
          content: <HttpResponseViewer responseHashKey={hash} />,
          closeable: true,
        },
      });

      // 3. Set loading state in the global response map
      updateResponseState({
        hash,
        state: { loading: true, error: null, request: { ...currentRequest } },
      });

      // 4. Prepare Headers
      const enabledHeaders = headers
        .filter((h) => h.enabled && h.key.trim())
        // biome-ignore lint/performance/noAccumulatingSpread: skip
        .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});

      let res: any;

      if (bodyType === "form-data") {
        // Use FormData for multipart/form-data
        const formData = new FormData();
        formData.append("__method", method);
        formData.append("__url", url);
        formData.append("__headers", JSON.stringify(enabledHeaders));

        for (const entry of formDataEntries) {
          if (entry.enabled && entry.key.trim()) {
            formData.append(entry.key, entry.value);
          }
        }

        res = await api.post("/api/httpreq", formData);
      } else {
        // Prepare JSON/Raw Payload
        let requestBody = body || "";
        if (bodyType === "json" && requestBody.trim()) {
          try {
            // Normalize JSON if applicable
            requestBody = JSON.stringify(JSON.parse(requestBody));
          } catch (_e) {
            /* send raw */
          }
        }

        res = await api.post("/api/httpreq", {
          method,
          url,
          headers: enabledHeaders,
          body: requestBody,
        });
      }

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
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Body</Label>
                <Tabs
                  value={bodyType}
                  onValueChange={(v) => setBodyType(v as any)}
                  className="w-auto"
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="json" className="text-xs">
                      JSON
                    </TabsTrigger>
                    <TabsTrigger value="form-data" className="text-xs">
                      Form-Data
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="text-xs">
                      Raw
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex-1 relative bg-muted/50 rounded-md border overflow-hidden min-h-[200px]">
                {bodyType === "json" && (
                  <JsonEditor
                    key={body}
                    initialJson={body ? JSON.parse(body) : {}}
                    rootFontSize={"13px"}
                    onChangeJson={(newJson) => setBody(newJson)}
                  />
                )}
                {bodyType === "form-data" && (
                  <div className="p-4 space-y-4 h-full overflow-auto">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        Multipart Form Data
                      </span>
                      <Button
                        onClick={() => addFormDataEntry()}
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Field
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {formDataEntries.map((entry) => (
                        <FormDataEntryRow
                          key={entry.id}
                          entry={entry}
                          onUpdate={updateFormDataEntry}
                          onRemove={removeFormDataEntry}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {bodyType === "raw" && (
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Raw request body..."
                    className="h-full w-full resize-none border-none focus-visible:ring-0 font-mono text-sm p-4 bg-transparent"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormDataEntryRow({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: any;
  onUpdate: (update: any) => void;
  onRemove: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpdate({ id: entry.id, field: "value", value: file });
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <input
        type="checkbox"
        checked={entry.enabled}
        onChange={(e) =>
          onUpdate({ id: entry.id, field: "enabled", value: e.target.checked })
        }
        className="w-4 h-4 rounded border-gray-300"
      />
      <Input
        value={entry.key}
        onChange={(e) =>
          onUpdate({ id: entry.id, field: "key", value: e.target.value })
        }
        placeholder="Key"
        className="flex-1 font-mono text-sm h-9"
      />
      <div className="flex-1 flex gap-2">
        <select
          value={entry.type}
          onChange={(e) =>
            onUpdate({ id: entry.id, field: "type", value: e.target.value })
          }
          className="px-2 py-1 border rounded bg-background text-[10px] h-9"
        >
          <option value="text">Text</option>
          <option value="file">File</option>
        </select>
        {entry.type === "text" ? (
          <Input
            value={entry.value instanceof File ? "" : entry.value}
            onChange={(e) =>
              onUpdate({ id: entry.id, field: "value", value: e.target.value })
            }
            placeholder="Value"
            className="flex-1 font-mono text-sm h-9"
          />
        ) : (
          <div className="flex-1 flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              className="h-9 flex-1 text-xs justify-start px-2 font-normal truncate max-w-[150px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileIcon className="h-3 w-3 mr-2 shrink-0" />
              {entry.value instanceof File ? entry.value.name : "Select File"}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}
      </div>
      <Button
        onClick={() => onRemove(entry.id)}
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

"use client";

import { format } from "date-fns";
import { useSetAtom } from "jotai";
import {
  Check,
  Clock,
  Copy,
  FileText,
  Loader2,
  Logs,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useDebounced } from "@/app/_hooks/use-debounced";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, fetcher } from "@/lib/api";
import { copyToClipboard, generateCurlCommand } from "@/lib/curl-gen-util";
import { generateLLMMarkdown } from "@/lib/llm-data-gen-util";
import type { ProxyBookmark } from "@/types";
import { FloatToolbar } from "../../_components/float-toolbar";
import { TagInput } from "../../_components/tag-input";
import { useSubscription } from "../../_hooks/use-subscription";
import { resetRequestAtom } from "../../_jotai/http-req";
import { BodySection } from "../../history/_components/body-section";
import { HeadersSection } from "../../history/_components/headers-section";
import { StatusBadge } from "../../history/_components/status-badge";

const updateBookmark = async (
  id: string,
  data: { note: string; tags: string },
) => {
  const res = await api.patch(`/api/bookmarks/${id}`, data);
  return res.data;
};

function tagsToString(tags: string[]) {
  return tags.join(" ");
}

interface SavedDetailsProps {
  id: string;
}

export function SavedDetails({ id }: SavedDetailsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // dirtyRef tracks if there are unsaved changes
  const dirtyRef = useRef(false);

  // Use a longer debounce for auto-saving during edit (2 seconds)
  const [debouncedNote] = useDebounced(note, 2000);
  const [debouncedTags] = useDebounced(tagsToString(tags), 2000);

  const {
    data: bookmark,
    error,
    mutate,
  } = useSWR<ProxyBookmark>(id ? `/api/bookmarks/${id}` : null, fetcher);

  // Initial load and sync from server
  useEffect(() => {
    // Only sync from SWR if we are not editing AND we don't have unsaved local changes
    if (bookmark && !isEditing && !dirtyRef.current) {
      setNote(bookmark.Note || "");
      const tagArray = bookmark.Tags
        ? bookmark.Tags.split(" ")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      setTags(tagArray);
    }
  }, [bookmark, isEditing]); // Removed id as bookmark already changes when switching

  const handleUpdate = useCallback(async () => {
    if (!dirtyRef.current) return;

    setIsSaving(true);
    try {
      const updated = await updateBookmark(id, {
        note,
        tags: tagsToString(tags),
      });
      setLastSavedAt(new Date());
      dirtyRef.current = false;
      // Update local SWR cache with the response
      mutate(updated, false);
    } catch (err) {
      console.error("Failed to update saved session", err);
    } finally {
      setIsSaving(false);
    }
  }, [id, note, tags, mutate]);

  // Handle periodic auto-save when debounced values change
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleUpdate is already debounced via these values
  useEffect(() => {
    if (dirtyRef.current) {
      handleUpdate();
    }
  }, [debouncedNote, debouncedTags]);

  // Handle immediate save on blur
  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (dirtyRef.current) {
      handleUpdate();
    }
  }, [handleUpdate]);

  useSubscription(
    "saved_sessions",
    ({
      type,
      bookmark: updatedBookmark,
    }: {
      type: string;
      bookmark: ProxyBookmark;
    }) => {
      // ONLY update if we are not currently editing AND not dirty to avoid loops and race conditions
      if (
        !isEditing &&
        !dirtyRef.current &&
        type === "update_session" &&
        updatedBookmark &&
        updatedBookmark.ID === id
      ) {
        if (updatedBookmark.Note !== note) {
          setNote(updatedBookmark.Note || "");
        }
        const updatedTags = updatedBookmark.Tags
          ? updatedBookmark.Tags.split(" ")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
        if (tagsToString(updatedTags) !== tagsToString(tags)) {
          setTags(updatedTags);
        }
      }
    },
  );

  if (error)
    return (
      <div className="p-8 text-destructive">
        Failed to load saved session details
      </div>
    );
  if (!bookmark)
    return <div className="p-8 text-muted-foreground">Loading details...</div>;

  return (
    <div className="h-full">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize="70%" minSize="30%">
          <SavedSessionInfo bookmark={bookmark} />
        </ResizablePanel>

        <ResizableHandle withHandle className="w-full h-[1px]" />

        <ResizablePanel defaultSize="30%" minSize="20%">
          <SavedMetadataEditor
            note={note}
            setNote={(val) => {
              setNote(val);
              dirtyRef.current = true;
            }}
            tags={tags}
            setTags={(val) => {
              setTags(val);
              dirtyRef.current = true;
            }}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onBlur={handleBlur}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function SavedSessionInfo({ bookmark }: { bookmark: ProxyBookmark }) {
  const [copied, setCopied] = useState(false);
  const [copiedLLM, setCopiedLLM] = useState(false);
  const [copiedToBuilder, setCopiedToBuilder] = useState(false);
  const resetRequest = useSetAtom(resetRequestAtom);

  const handleCopyCurl = async () => {
    const curlCommand = generateCurlCommand({
      method: bookmark.RequestMethod,
      url: bookmark.RequestURLFull,
      headers: bookmark.RequestHeaders,
      body: bookmark.RequestBody,
      contentType: bookmark.RequestContentType,
    });

    const success = await copyToClipboard(curlCommand);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLLM = async () => {
    const sessionData = {
      session: {
        ID: bookmark.SessionID,
        Timestamp: bookmark.Timestamp,
        DurationMs: bookmark.DurationMs,
        RequestMethod: bookmark.RequestMethod,
        RequestPath: bookmark.RequestPath,
        RequestProto: bookmark.RequestProto,
        RequestHost: bookmark.RequestHost,
        RequestURLFull: bookmark.RequestURLFull,
        ResponseStatusCode: bookmark.ResponseStatusCode,
        ResponseStatusText: bookmark.ResponseStatusText,
        RequestBody: bookmark.RequestBody,
        RequestBodySize: bookmark.RequestBodySize,
        RequestContentType: bookmark.RequestContentType,
        ResponseBody: bookmark.ResponseBody,
        ResponseBodySize: bookmark.ResponseBodySize,
        ResponseContentType: bookmark.ResponseContentType,
      },
      request_headers: bookmark.RequestHeaders,
      response_headers: bookmark.ResponseHeaders,
      query_parameters: bookmark.QueryParameters,
    };

    const markdown = generateLLMMarkdown(sessionData);

    const success = await copyToClipboard(markdown);
    if (success) {
      setCopiedLLM(true);
      setTimeout(() => setCopiedLLM(false), 2000);
    }
  };

  const handleCopyToHttpReq = () => {
    const headers = Object.entries(
      bookmark.RequestHeaders as Record<string, string[]>,
    ).map(([key, values], index) => ({
      id: `${Date.now()}-${index}`,
      key: key,
      value: values.join(", "),
      enabled: true,
    }));

    resetRequest({
      method: bookmark.RequestMethod,
      url: bookmark.RequestURLFull,
      headers: headers,
      body: bookmark.RequestBody || "",
    });

    setCopiedToBuilder(true);
    setTimeout(() => setCopiedToBuilder(false), 2000);
  };

  const formatConfigJSON = (json: string) => {
    try {
      if (typeof json === "object") return JSON.stringify(json, null, 2);
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch (_e) {
      return json;
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="p-4 bg-background shadow-sm border-b shrink-0">
        <div className="flex items-start justify-between mb-[5px]">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge code={bookmark.ResponseStatusCode} />
              <span className="font-bold text-lg font-mono">
                {bookmark.RequestMethod}
              </span>
              <span className="font-mono text-muted-foreground">
                {bookmark.RequestPath}
              </span>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {bookmark.DurationMs}ms
              </span>
              <span>{format(new Date(bookmark.Timestamp), "PP pp")}</span>
              <span>
                Saved: {format(new Date(bookmark.CreatedAt), "PP pp")}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{bookmark.RequestProto}</Badge>
          </div>
        </div>
      </div>

      <div className="relative">
        <FloatToolbar top="top-24">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyCurl}
                className="h-9 w-9 text-primary hover:bg-primary/20"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{copied ? "Copied!" : "Copy as cURL Command"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyLLM}
                className="h-9 w-9 text-primary hover:bg-primary/20"
              >
                {copiedLLM ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{copiedLLM ? "Copied!" : "Copy for LLM"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyToHttpReq}
                className="h-9 w-9 text-primary hover:bg-primary/20"
              >
                {copiedToBuilder ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>
                {copiedToBuilder
                  ? "Loaded to Builder!"
                  : "Copy to HTTP Request Builder"}
              </p>
            </TooltipContent>
          </Tooltip>
        </FloatToolbar>
      </div>

      <div className="flex-1 relative flex flex-col overflow-hidden h-full min-h-0">
        <Tabs
          defaultValue="overview"
          className="flex-1 h-full overflow-hidden min-h-0"
        >
          <div className="px-4 py-2 bg-background shrink-0">
            <TabsList className="h-12">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="response" className="flex items-center gap-2">
                <Logs className="h-3.5 w-3.5" />
                Response
              </TabsTrigger>
              <TabsTrigger value="request" className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Request
              </TabsTrigger>
              <TabsTrigger value="environment">Environment</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="overview"
            className="flex-1 overflow-auto m-0 px-6 py-2 space-y-2 text-sm"
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="font-medium text-muted-foreground">URL</div>
              <div className="col-span-2 font-mono break-all">
                {bookmark.RequestURLFull}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="font-medium text-muted-foreground">Method</div>
              <div className="col-span-2 font-mono">
                {bookmark.RequestMethod}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="font-medium text-muted-foreground">Host</div>
              <div className="col-span-2 font-mono">{bookmark.RequestHost}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="font-medium text-muted-foreground">Status</div>
              <div className="col-span-2 font-mono">
                {bookmark.ResponseStatusCode} {bookmark.ResponseStatusText}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="font-medium text-muted-foreground">Duration</div>
              <div className="col-span-2 font-mono">
                {bookmark.DurationMs} ms
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="font-medium text-muted-foreground">Timestamp</div>
              <div className="col-span-2 font-mono">{bookmark.Timestamp}</div>
            </div>
          </TabsContent>

          <TabsContent value="request" className="flex-1 m-0 px-2 min-h-0">
            <div className="px-4 py-1 pt-0 space-y-6 flex flex-col h-full">
              <HeadersSection
                title="Headers"
                data={bookmark.RequestHeaders as any}
              />
              <HeadersSection
                title="Query Parameters"
                data={bookmark.QueryParameters as any}
              />
              <BodySection
                title="Request Body"
                body={bookmark.RequestBody}
                size={bookmark.RequestBodySize}
                type={bookmark.RequestContentType}
              />
            </div>
          </TabsContent>

          <TabsContent value="response" className="flex-1 m-0 px-2 min-h-0">
            <div className="px-4 py-1 pt-0 space-y-6 flex flex-col h-full">
              <HeadersSection
                title="Headers"
                data={bookmark.ResponseHeaders as any}
              />
              <BodySection
                title="Response Body"
                body={bookmark.ResponseBody}
                size={bookmark.ResponseBodySize}
                type={bookmark.ResponseContentType}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="environment"
            className="flex-1 overflow-auto m-0 px-6 py-2 space-y-4"
          >
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-muted-foreground">
                Config Source Path
              </h4>
              <div className="text-sm font-mono bg-muted p-2 rounded-sm border">
                {bookmark.ConfigSourcePath || "N/A"}
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-muted-foreground">
                Configuration JSON
              </h4>
              <pre className="text-[11px] font-mono bg-muted p-3 rounded-sm border overflow-auto max-h-[400px]">
                {formatConfigJSON(bookmark.ConfigJSON)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

import { MarkdownPreview } from "../../_components/markdown-preview";

interface SavedMetadataEditorProps {
  note: string;
  setNote: (val: string) => void;
  tags: string[];
  setTags: (val: string[]) => void;
  isSaving: boolean;
  lastSavedAt: Date | null;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  onBlur: () => void;
}

function SavedMetadataEditor({
  note,
  setNote,
  tags,
  setTags,
  isSaving,
  lastSavedAt,
  isEditing,
  setIsEditing,
  onBlur,
}: SavedMetadataEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              Tags & Notes
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isSaving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              ) : lastSavedAt ? (
                <span>Last saved at {format(lastSavedAt, "HH:mm:ss")}</span>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Tags (Press Space to add)
            </Label>
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder="e.g. auth bug"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Note (Markdown supported)
            </Label>
            <div className="min-h-[150px] relative group">
              {isEditing ? (
                <Textarea
                  ref={textareaRef}
                  placeholder="Add some context about this session (Markdown supported)..."
                  className="min-h-[150px] font-mono text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={onBlur}
                />
              ) : (
                <div
                  className="min-h-[150px] p-3 rounded-md border bg-muted/20 cursor-text hover:border-primary/50 transition-colors"
                  onClick={() => setIsEditing(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setIsEditing(true);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Edit note"
                >
                  <MarkdownPreview content={note} />
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

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

  const [debouncedNote] = useDebounced(note, 1000);
  const [debouncedTags] = useDebounced(tagsToString(tags), 1000);

  const initialLoadRef = useRef(true);

  const { data: bookmark, error } = useSWR<ProxyBookmark>(
    id ? `/api/bookmarks/${id}` : null,
    fetcher,
  );

  useEffect(() => {
    if (bookmark) {
      setNote(bookmark.Note || "");
      const tagArray = bookmark.Tags
        ? bookmark.Tags.split(" ")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      setTags(tagArray);
      initialLoadRef.current = true;
    }
  }, [bookmark]);

  const handleUpdate = useCallback(async () => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    setIsSaving(true);
    try {
      await updateBookmark(id, { note, tags: tagsToString(tags) });
      setLastSavedAt(new Date());
    } catch (err) {
      console.error("Failed to update saved session", err);
    } finally {
      setIsSaving(false);
    }
  }, [id, note, tags]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: needed
  useEffect(() => {
    if (!initialLoadRef.current) {
      handleUpdate();
    }
  }, [debouncedNote, debouncedTags, handleUpdate]);

  useSubscription(
    "saved_sessions",
    ({
      type,
      bookmark: updatedBookmark,
    }: {
      type: string;
      bookmark: ProxyBookmark;
    }) => {
      if (
        type === "update_session" &&
        updatedBookmark &&
        updatedBookmark.ID === id
      ) {
        // Only update if it's not the same one we're currently editing (to avoid race conditions/flickering)
        // Actually, we should check if the content is different
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
              initialLoadRef.current = false;
              setNote(val);
            }}
            tags={tags}
            setTags={(val) => {
              initialLoadRef.current = false;
              setTags(val);
            }}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function SavedSessionInfo({ bookmark }: { bookmark: ProxyBookmark }) {
  const [copied, setCopied] = useState(false);
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

interface SavedMetadataEditorProps {
  note: string;
  setNote: (val: string) => void;
  tags: string[];
  setTags: (val: string[]) => void;
  isSaving: boolean;
  lastSavedAt: Date | null;
}

function SavedMetadataEditor({
  note,
  setNote,
  tags,
  setTags,
  isSaving,
  lastSavedAt,
}: SavedMetadataEditorProps) {
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
              Note
            </Label>
            <Textarea
              placeholder="Add some context about this session..."
              className="min-h-[100px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

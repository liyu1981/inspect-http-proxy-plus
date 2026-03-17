"use client";

import { format } from "date-fns";
import { useSetAtom } from "jotai";
import {
  Bookmark,
  Check,
  Clock,
  Copy,
  FileText,
  Logs,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useGlobal } from "@/app/_components/global-app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, fetcher } from "@/lib/api";
import { copyToClipboard, generateCurlCommand } from "@/lib/curl-gen-util";
import { generateLLMMarkdown } from "@/lib/llm-data-gen-util";
import type { SessionDetailResponse } from "@/types";
import { FloatToolbar } from "../../_components/float-toolbar";
import { resetRequestAtom } from "../../_jotai/http-req";
import { BodySection } from "./body-section";
import { HeadersSection } from "./headers-section";
import { StatusBadge } from "./status-badge";

const createBookmark = async (sessionId: string) => {
  const res = await api.post(`/api/bookmarks/${sessionId}`);
  return res.data;
};

interface SessionDetailsProps {
  id: string;
}

interface ConfigJSON {
  listen: string;
  target: string;
  truncate_log_body: boolean;
  active: boolean;
  error: string;
}

export function SessionDetails({ id }: SessionDetailsProps) {
  const { allConfigs } = useGlobal();
  const [copied, setCopied] = useState(false);
  const [copiedLLM, setCopiedLLM] = useState(false);
  const [copiedToBuilder, setCopiedToBuilder] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const resetRequest = useSetAtom(resetRequestAtom);

  // Track all pending timeouts so we can clear them on unmount
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const safeTimeout = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timeoutsRef.current.push(t);
  };

  // Clear all timeouts on unmount to prevent setState on unmounted component
  // which keeps fiber references alive
  useEffect(() => {
    return () => {
      for (const t of timeoutsRef.current) {
        clearTimeout(t);
      }
      timeoutsRef.current = [];
    };
  }, []);

  const { cache } = useSWRConfig();

  // Evict this session's SWR cache entry on unmount.
  // Without this, every clicked session accumulates its full response body
  // (RequestBody + ResponseBody) in SWR's global cache indefinitely,
  // which retains the associated fiber tree and causes the ~1GB growth per click.
  useEffect(() => {
    return () => {
      cache.delete(`/api/sessions/${id}`);
    };
  }, [id, cache]);

  const { data, error } = useSWR<SessionDetailResponse>(
    `/api/sessions/${id}`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  // Stable reference to session
  const session = data?.session;

  console.log("session is", session);

  // Memoize config lookup based on session's ConfigID to avoid re-parsing JSON every render
  const sessionConfig = useMemo(() => {
    if (!session || !allConfigs) return undefined;
    return Array.isArray(allConfigs)
      ? allConfigs.find((config) => config.id === session.ConfigID)
      : undefined;
  }, [allConfigs, session]);

  const sessionConfigObj = useMemo(() => {
    try {
      const parsed = JSON.parse(
        sessionConfig?.config_row.ConfigJSON || "{}",
      ) as ConfigJSON;
      return {
        listen: parsed.listen || "",
        target: parsed.target || sessionConfig?.target_url || "",
      };
    } catch {
      return {
        listen: "",
        target: sessionConfig?.target_url || "",
      };
    }
  }, [sessionConfig]);

  const requestHeaders = data?.request_headers;
  const responseHeaders = data?.response_headers;
  const queryParameters = data?.query_parameters;

  const handleBookmark = async () => {
    if (!data) return;
    try {
      await createBookmark(id);
      setBookmarked(true);
      safeTimeout(() => setBookmarked(false), 2000);
    } catch (err) {
      console.error("Failed to bookmark session", err);
    }
  };

  const handleCopyCurl = async () => {
    if (!data || !session) return;

    const curlCommand = generateCurlCommand({
      method: session.RequestMethod,
      url: `http://localhost${sessionConfigObj.listen}${session.RequestPath}`,
      headers: requestHeaders as any,
      body: session.RequestBody,
      contentType: session.RequestContentType,
    });

    const success = await copyToClipboard(curlCommand);
    if (success) {
      setCopied(true);
      safeTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLLM = async () => {
    if (!data) return;

    const markdown = generateLLMMarkdown(data);

    const success = await copyToClipboard(markdown);
    if (success) {
      setCopiedLLM(true);
      safeTimeout(() => setCopiedLLM(false), 2000);
    }
  };

  const handleCopyToHttpReq = () => {
    if (!data || !session) return;

    const headers = Object.entries(requestHeaders ?? {}).map(
      ([key, values], index) => ({
        id: `${Date.now()}-${index}`,
        key: key,
        value: values.join(", "),
        enabled: true,
      }),
    );

    const fullUrl = `http://${session.RequestHost}${session.RequestPath}`;

    resetRequest({
      method: session.RequestMethod,
      url: fullUrl,
      headers: headers,
      body: session.RequestBody || "",
    });

    setCopiedToBuilder(true);
    safeTimeout(() => setCopiedToBuilder(false), 2000);
  };

  if (error)
    return (
      <div className="p-8 text-destructive">Failed to load session details</div>
    );
  if (!data || !session)
    return <div className="p-8 text-muted-foreground">Loading details...</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-background shadow-sm border-b">
        <div className="flex items-start justify-between mb-[5px]">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge code={session.ResponseStatusCode} />
              <span className="font-bold text-lg font-mono">
                {session.RequestMethod}
              </span>
              <span className="font-mono text-muted-foreground">
                {session.RequestPath}
              </span>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {session.DurationMs}ms
              </span>
              <span>{format(new Date(session.Timestamp), "PP pp")}</span>
              <span>
                Client: {session.ClientIP} {"🠞"} Server: {session.RequestHost}{" "}
                {"🠞"} {sessionConfigObj.target}
              </span>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="outline">{session.RequestProto}</Badge>
          </div>
        </div>
      </div>

      <div className="relative">
        <FloatToolbar top="top-8">
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
                <Send className="h-4 w-4" />
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBookmark}
                className="h-9 w-9 text-primary hover:bg-primary/20"
              >
                {bookmarked ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{bookmarked ? "Saved!" : "Save for notes"}</p>
            </TooltipContent>
          </Tooltip>
        </FloatToolbar>
      </div>

      <div className="p-6 pt-4 ">
        <div className="px-1 bg-background text-sm">
          <Tabs
            defaultValue="overview"
            className="flex flex-col overflow-hidden"
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="overflow-auto p-0 m-0 px-4"
            >
              <div className="grid grid-cols-3 gap-2">
                <div className="font-medium">Query</div>
                <div className="col-span-2 font-mono break-all">
                  {session.RequestURLFull}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="font-medium">Remote Host</div>
                <div className="col-span-2 font-mono">
                  {session.RequestHost} {"🠞"} {sessionConfigObj.target}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="font-medium">Client Address</div>
                <div className="col-span-2 font-mono">{session.ClientAddr}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="font-medium">Status Code</div>
                <div className="col-span-2 font-mono break-all">
                  {session.ResponseStatusCode}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="font-medium">Time Initiated</div>
                <div className="col-span-2 font-mono break-all">
                  {session.Timestamp}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="font-medium">Time Used</div>
                <div className="col-span-2 font-mono break-all">
                  {session.DurationMs} ms
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col overflow-hidden">
        <Tabs
          defaultValue="response"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 bg-background">
            <TabsList>
              <TabsTrigger value="response" className="flex items-center gap-2">
                <Logs className="h-3.5 w-3.5" />
                Response
              </TabsTrigger>
              <TabsTrigger value="request" className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Request
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="request"
            className="flex-1 overflow-auto p-0 m-0 px-2"
          >
            <div className="p-6 space-y-6 flex flex-col h-full">
              <HeadersSection title="Headers" data={requestHeaders} />
              <HeadersSection title="Query Parameters" data={queryParameters} />
              <BodySection
                title="Request Body"
                body={session.RequestBody}
                size={session.RequestBodySize}
                type={session.RequestContentType}
                encoding={session.RequestContentEncoding}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="response"
            className="flex-1 overflow-auto p-0 m-0 px-2"
          >
            <div className="p-6 space-y-6 flex flex-col h-full">
              <HeadersSection title="Headers" data={responseHeaders} />
              <BodySection
                title="Response Body"
                body={session.ResponseBody}
                size={session.ResponseBodySize}
                type={session.ResponseContentType}
                encoding={session.ResponseContentEncoding}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

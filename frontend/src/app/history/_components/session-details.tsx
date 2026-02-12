"use client";

import { format } from "date-fns";
import { useSetAtom } from "jotai";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  Copy,
  Send,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { useGlobal } from "@/app/_components/global-app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, fetcher } from "@/lib/api";
import { copyToClipboard, generateCurlCommand } from "@/lib/curl-gen-util";
import type { SessionDetailResponse } from "@/types";
import { resetRequestAtom } from "../../_jotai/http-req";
import { BodySection } from "./body-section";
import { useConfig } from "./config-provider";
import { HeadersSection } from "./headers-section";
import { StatusBadge } from "./status-badge";

const createBookmark = async (sessionId: string) => {
  const res = await api.post(`/api/bookmarks/${sessionId}`);
  return res.data;
};

interface SessionDetailsProps {
  id: string;
}

export function SessionDetails({ id }: SessionDetailsProps) {
  const { selectedConfigId } = useConfig();
  const { allConfigs } = useGlobal();
  const [copied, setCopied] = useState(false);
  const [copiedToBuilder, setCopiedToBuilder] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const resetRequest = useSetAtom(resetRequestAtom);

  const selectedConfig = allConfigs.find(
    (config) => config.id === selectedConfigId,
  );
  const selectedConfigObj = JSON.parse(
    selectedConfig?.config_row.ConfigJSON || "{}",
  );

  const { data, error } = useSWR<SessionDetailResponse>(
    `/api/sessions/${id}`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  const handleBookmark = async () => {
    if (!data) return;
    try {
      await createBookmark(id);
      setBookmarked(true);
      setTimeout(() => setBookmarked(false), 2000);
    } catch (err) {
      console.error("Failed to bookmark session", err);
    }
  };

  const handleCopyCurl = async () => {
    if (!data) return;

    const { session, request_headers } = data;

    const curlCommand = generateCurlCommand({
      method: session.RequestMethod,
      url: `http://localhost${selectedConfigObj.listen}${session.RequestPath}`,
      headers: request_headers,
      body: session.RequestBody,
      contentType: session.RequestContentType,
    });

    const success = await copyToClipboard(curlCommand);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyToHttpReq = () => {
    if (!data) return;

    const { session, request_headers } = data;

    // Convert headers array to the format expected by HTTP request builder
    const headers = Object.entries(request_headers).map(
      ([key, values], index) => ({
        id: `${Date.now()}-${index}`,
        key: key,
        value: values.join(", "), // Join multiple values with comma-space
        enabled: true,
      }),
    );

    // Build the full URL
    const fullUrl = `http://${session.RequestHost}${session.RequestPath}`;

    // Reset the request atom with the session data
    resetRequest({
      method: session.RequestMethod,
      url: fullUrl,
      headers: headers,
      body: session.RequestBody || "",
    });

    // Show feedback
    setCopiedToBuilder(true);
    setTimeout(() => setCopiedToBuilder(false), 2000);
  };

  if (error)
    return (
      <div className="p-8 text-destructive">Failed to load session details</div>
    );
  if (!data)
    return <div className="p-8 text-muted-foreground">Loading details...</div>;

  const { session, request_headers, response_headers, query_parameters } = data;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-background shadow-sm">
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
                {"🠞"} {selectedConfigObj.Target}
              </span>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="outline">{session.RequestProto}</Badge>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Floating Toolbar */}
        <div className="absolute top-8 right-0 z-10 flex gap-2 bg-primary/10 p-1 border rounded-md rounded-r-none shadow-md">
          <div className="flex flex-col space-y-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCurl}
                    className="h-9 w-9"
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
                    variant="outline"
                    size="icon"
                    onClick={handleCopyToHttpReq}
                    className="h-9 w-9"
                  >
                    {copiedToBuilder ? (
                      <Send className="h-4 w-4" />
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

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleBookmark}
                    className="h-9 w-9"
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
            </TooltipProvider>
          </div>
        </div>
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
                  {session.RequestHost} {"🠞"} {selectedConfigObj.Target}
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
              <TabsTrigger value="response">Response</TabsTrigger>
              <TabsTrigger value="request">Request</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="request"
            className="flex-1 overflow-auto p-0 m-0 px-2"
          >
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <HeadersSection title="Headers" data={request_headers} />
                <HeadersSection
                  title="Query Parameters"
                  data={query_parameters}
                />
                <BodySection
                  title="Request Body"
                  body={session.RequestBody}
                  size={session.RequestBodySize}
                  type={session.RequestContentType}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="response"
            className="flex-1 overflow-auto p-0 m-0 px-2"
          >
            <div className="p-6 space-y-6 flex flex-col h-full">
              <HeadersSection title="Headers" data={response_headers} />
              <BodySection
                title="Response Body"
                body={session.ResponseBody}
                size={session.ResponseBodySize}
                type={session.ResponseContentType}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

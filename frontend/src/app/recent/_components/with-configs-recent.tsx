"use client";

import * as React from "react";
import { useDebounced } from "@/app/_hooks/use-debounced";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { ProxySessionStub, SessionListResponse } from "@/types";
import { useSubscription } from "../../_hooks/use-subscription";
import { EmptySessionState } from "../../history/_components/empty-session-state";
import { SessionDetails } from "../../history/_components/session-details";
import { SessionList } from "../../history/_components/session-list";

export function getCacheKey(
  persistKey: string | null | undefined,
  configId: string,
) {
  return persistKey && configId
    ? `sessions_cache_${persistKey}_${configId}`
    : null;
}

interface WithConfigsRecentProps {
  configId: string;
  searchQuery: string;
  filterMethod: string;
  filterStatus: string;
  onSearchQueryChange: (val: string) => void;
  onFilterMethodChange: (val: string) => void;
  onFilterStatusChange: (val: string) => void;
  initLoadSessions?: (
    configId: string,
    params: URLSearchParams,
  ) => Promise<SessionListResponse>;
  mergeSessions?: (
    prev: ProxySessionStub[],
    session: ProxySessionStub,
  ) => ProxySessionStub[];
  persistKey?: string;
}

export function WithConfigsRecent({
  configId,
  searchQuery,
  filterMethod,
  filterStatus,
  onSearchQueryChange,
  onFilterMethodChange,
  onFilterStatusChange,
  initLoadSessions,
  mergeSessions,
  persistKey,
}: WithConfigsRecentProps) {
  const [selectedSessionId, setSelectedSessionId] = React.useState<
    string | null
  >(null);

  const [debouncedSearchQuery, _setDebouncedSearchQuery] = useDebounced(
    searchQuery,
    500,
  );

  const [allLoadedSessions, setAllLoadedSessions] = React.useState<
    ProxySessionStub[]
  >([]);

  // If with cache then persist to localStorage when sessions change
  const cacheKey = getCacheKey(persistKey, configId);
  React.useEffect(() => {
    if (cacheKey && allLoadedSessions.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify(allLoadedSessions));
    }
  }, [allLoadedSessions, cacheKey]);

  const [offset, setOffset] = React.useState<number>(0);
  const [limit] = React.useState<number>(50);
  const [isLoadingMore, setIsLoadingMore] = React.useState<boolean>(false);

  // Build query string
  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", limit.toString());
    p.set("offset", offset.toString());
    if (filterMethod) {
      p.set("method", filterMethod);
    }
    if (filterStatus) {
      p.set("status", filterStatus);
    }
    if (debouncedSearchQuery) {
      p.set("q", debouncedSearchQuery);
    }
    return p;
  }, [limit, offset, filterMethod, filterStatus, debouncedSearchQuery]);

  const [sessionList, setSessionList] =
    React.useState<SessionListResponse | null>(null);

  React.useEffect(() => {
    if (initLoadSessions) {
      initLoadSessions(configId, params).then(setSessionList);
    }
  }, [configId, initLoadSessions, params]);

  // Merge new data into allLoadedSessions
  React.useEffect(() => {
    if (sessionList?.sessions) {
      if (offset === 0) {
        // Initial load or filter change - replace all
        setAllLoadedSessions(sessionList.sessions);
      } else {
        // Load more - append new sessions
        setAllLoadedSessions((prev) => {
          const newSessions = sessionList.sessions.filter(
            (newSession) => !prev.some((s) => s.ID === newSession.ID),
          );
          return [...prev, ...newSessions];
        });
      }
      setIsLoadingMore(false);
    }
  }, [sessionList, offset]);

  useSubscription(
    "sessions",
    ({
      session,
      type,
      ids,
    }: {
      session: ProxySessionStub;
      type: string;
      ids?: string[];
    }) => {
      console.log(
        "received session update via subscription:",
        type,
        session || ids,
        configId,
      );

      if (type === "new_session" && session) {
        if (session.ConfigID !== configId) {
          return;
        }

        // mergeSessions will merge and update allLoadedSessions
        if (mergeSessions) {
          setAllLoadedSessions((prev) => mergeSessions(prev, session));
        }
      } else if (type === "delete_session" && ids) {
        setAllLoadedSessions((prev) => prev.filter((s) => !ids.includes(s.ID)));
        if (selectedSessionId && ids.includes(selectedSessionId)) {
          setSelectedSessionId(null);
        }
      }
    },
  );

  React.useEffect(() => {
    if (allLoadedSessions.length > 0) {
      if (
        allLoadedSessions.findIndex((s) => s.ID === selectedSessionId) === -1
      ) {
        setSelectedSessionId(allLoadedSessions[0].ID);
      }
    }
  }, [allLoadedSessions, selectedSessionId]);

  // Check if there are more sessions to load
  const hasMore =
    sessionList && sessionList.sessions
      ? sessionList?.sessions.length === limit
      : false;

  const handleSessionClick = (id: string) => {
    setSelectedSessionId(id);
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setOffset((prev) => prev + limit);
  };

  return (
    <ResizablePanelGroup orientation="horizontal">
      {/* List Panel */}
      <ResizablePanel defaultSize={"40%"} minSize={"30%"} maxSize={"50%"}>
        <SessionList
          sessions={allLoadedSessions}
          selectedSessionId={selectedSessionId}
          filterMethod={filterMethod}
          filterStatus={filterStatus}
          searchQuery={searchQuery}
          totalLoaded={allLoadedSessions.length}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onSessionClick={handleSessionClick}
          onFilterMethodChange={onFilterMethodChange}
          onFilterStatusChange={onFilterStatusChange}
          onSearchQueryChange={onSearchQueryChange}
          onClearFilters={() => {
            onFilterMethodChange("");
            onFilterStatusChange("");
            onSearchQueryChange("");
          }}
          onLoadMore={handleLoadMore}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Details Panel */}
      <ResizablePanel defaultSize={"60%"}>
        <div className="h-full bg-muted/10">
          {selectedSessionId ? (
            <SessionDetails id={selectedSessionId} />
          ) : (
            <EmptySessionState />
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

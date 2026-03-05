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
import { BulkSelectionBar } from "../../history/_components/bulk-selection-bar";
import { EmptySessionState } from "../../history/_components/empty-session-state";
import { SessionDetails } from "../../history/_components/session-details";
import { SessionList } from "../../history/_components/session-list";

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
}: WithConfigsRecentProps) {
  const [selectedSessionId, setSelectedSessionId] = React.useState<
    string | null
  >(null);

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [debouncedSearchQuery] = useDebounced(searchQuery, 500);

  const [allLoadedSessions, setAllLoadedSessions] = React.useState<
    ProxySessionStub[]
  >([]);

  const [offset, setOffset] = React.useState<number>(0);
  const [limit] = React.useState<number>(50);
  const [isLoadingMore, setIsLoadingMore] = React.useState<boolean>(false);

  // Build query string
  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", limit.toString());
    p.set("offset", offset.toString());
    if (filterMethod) p.set("method", filterMethod);
    if (filterStatus) p.set("status", filterStatus);
    if (debouncedSearchQuery) p.set("q", debouncedSearchQuery);
    return p;
  }, [limit, offset, filterMethod, filterStatus, debouncedSearchQuery]);

  const [sessionList, setSessionList] =
    React.useState<SessionListResponse | null>(null);

  React.useEffect(() => {
    if (initLoadSessions) {
      initLoadSessions(configId, params).then((res) => {
        setSessionList(res);
      });
    }
  }, [configId, initLoadSessions, params]);

  // Merge new data into allLoadedSessions
  React.useEffect(() => {
    if (sessionList?.sessions) {
      if (offset === 0) {
        setAllLoadedSessions(sessionList.sessions);
      } else {
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

  // Use a ref for selectedSessionId inside the subscription callback so it
  // always reads the latest value without being a reactive dependency —
  // this prevents the subscription from re-registering on every selection change.
  const selectedSessionIdRef = React.useRef(selectedSessionId);
  React.useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

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
      // console.log(
      //   "received session update via subscription:",
      //   type,
      //   session || ids,
      //   configId,
      // );

      if (type === "new_session" && session) {
        if (session.ConfigID !== configId) return;
        if (mergeSessions) {
          setAllLoadedSessions((prev) => mergeSessions(prev, session));
        }
      } else if (type === "delete_session" && ids) {
        setAllLoadedSessions((prev) => prev.filter((s) => !ids.includes(s.ID)));
        // Read from ref — no stale closure, no re-subscription
        if (
          selectedSessionIdRef.current &&
          ids.includes(selectedSessionIdRef.current)
        ) {
          setSelectedSessionId(null);
        }
      }
    },
  );

  // Auto-select the first session when the list loads or changes,
  // but only if the current selection is no longer in the list.
  // IMPORTANT: selectedSessionId is intentionally NOT in deps here.
  // Including it caused a render loop: setSelectedSessionId → effect re-runs
  // → setSelectedSessionId again → SessionDetails re-renders on every subscription update.
  // We use a ref to read the latest value without making it a reactive dependency.
  React.useEffect(() => {
    if (allLoadedSessions.length > 0) {
      const currentId = selectedSessionIdRef.current;
      const stillExists = allLoadedSessions.some((s) => s.ID === currentId);
      if (!stillExists) {
        setSelectedSessionId(allLoadedSessions[0].ID);
      }
    }
  }, [allLoadedSessions]); // ← selectedSessionId removed from deps

  // Check if there are more sessions to load
  const hasMore =
    sessionList && sessionList.sessions
      ? sessionList.sessions.length === limit
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
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
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
        <div className="h-full bg-muted/10 relative">
          {selectedSessionId ? (
            <SessionDetails id={selectedSessionId} />
          ) : (
            <EmptySessionState />
          )}

          <BulkSelectionBar
            selectedIds={selectedIds}
            onClearSelection={() => setSelectedIds([])}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

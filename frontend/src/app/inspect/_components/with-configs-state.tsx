"use client";

import * as React from "react";
import useSWR from "swr";
import { useGlobal } from "@/app/_components/global-app-context";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { fetcher } from "@/lib/api";
import type { ProxySessionStub, SessionListResponse } from "@/types";
import { useSubscription } from "../../_hooks/use-subscription";
import { useConfig } from "./config-provider";
import { EmptySessionState } from "./empty-session-state";
import { SessionDetails } from "./session-details";
import { SessionList } from "./session-list";

interface WithConfigsStateProps {
  onMutate: (mutate: () => void) => void;
  onValidatingChange: (isValidating: boolean) => void;
}

export function WithConfigsState({
  onMutate,
  onValidatingChange,
}: WithConfigsStateProps) {
  const [selectedSessionId, setSelectedSessionId] = React.useState<
    string | null
  >(null);
  const [filterMethod, setFilterMethod] = React.useState<string>("");
  const [filterStatus, setFilterStatus] = React.useState<string>("");
  const [allLoadedSessions, setAllLoadedSessions] = React.useState<
    ProxySessionStub[]
  >([]);
  const [offset, setOffset] = React.useState<number>(0);
  const [limit] = React.useState<number>(50);
  const [isLoadingMore, setIsLoadingMore] = React.useState<boolean>(false);

  const { allConfigs } = useGlobal();
  const { selectedConfigId, setSelectedConfigId } = useConfig();

  // Initialize selectedConfigId if not set
  React.useEffect(() => {
    if (!selectedConfigId && allConfigs.length > 0) {
      setSelectedConfigId(allConfigs[0].id);
    }
  }, [selectedConfigId, allConfigs, setSelectedConfigId]);

  // Reset loaded sessions when filters or config change
  React.useEffect(() => {
    setAllLoadedSessions([]);
    setOffset(0);
  }, []);

  // Build query string
  const params = new URLSearchParams();
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());
  if (filterMethod) params.set("method", filterMethod);
  if (filterStatus) params.set("status", filterStatus);

  // Use selectedConfigId instead of allConfigs[0]
  const configId = selectedConfigId || allConfigs[0]?.id || "";

  const {
    data: sessionList,
    mutate,
    isValidating,
  } = useSWR<SessionListResponse>(
    configId ? `/api/sessions/recent/${configId}?${params.toString()}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

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

  // Pass mutate function to parent
  React.useEffect(() => {
    onMutate(() => mutate());
  }, [mutate, onMutate]);

  // Pass isValidating to parent
  React.useEffect(() => {
    onValidatingChange(isValidating);
  }, [isValidating, onValidatingChange]);

  useSubscription("sessions", (session: ProxySessionStub) => {
    if (session.ConfigID !== configId) {
      return;
    }

    // Check if the new session matches current filters
    if (filterMethod && session.RequestMethod !== filterMethod.toUpperCase()) {
      return;
    }

    if (
      filterStatus &&
      !session.ResponseStatusCode.toString().includes(filterStatus)
    ) {
      return;
    }

    // Update allLoadedSessions
    setAllLoadedSessions((prev) => {
      const existingIndex = prev.findIndex((s) => s.ID === session.ID);

      if (existingIndex > -1) {
        // Update existing session
        const updated = [...prev];
        updated[existingIndex] = session;
        return updated;
      } else {
        // Add new session to the beginning
        return [session, ...prev];
      }
    });
  });

  React.useEffect(() => {
    if (allLoadedSessions.length > 0) {
      if (
        allLoadedSessions.findIndex((s) => s.ID === selectedSessionId) === -1
      ) {
        setSelectedSessionId(allLoadedSessions[0].ID);
      }
    }
  }, [allLoadedSessions, selectedSessionId]);

  const handleSessionClick = (id: string) => {
    setSelectedSessionId(id);
  };

  const clearFilters = () => {
    setFilterMethod("");
    setFilterStatus("");
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setOffset((prev) => prev + limit);
  };

  // Check if there are more sessions to load
  const hasMore = sessionList?.sessions.length === limit;

  return (
    <ResizablePanelGroup orientation="horizontal">
      {/* List Panel */}
      <ResizablePanel defaultSize={"40%"} minSize={"30%"} maxSize={"50%"}>
        <SessionList
          sessions={allLoadedSessions}
          selectedSessionId={selectedSessionId}
          filterMethod={filterMethod}
          filterStatus={filterStatus}
          totalLoaded={allLoadedSessions.length}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onSessionClick={handleSessionClick}
          onFilterMethodChange={setFilterMethod}
          onFilterStatusChange={setFilterStatus}
          onClearFilters={clearFilters}
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

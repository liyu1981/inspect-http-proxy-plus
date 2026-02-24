"use client";

import { format } from "date-fns";
import { ArrowLeftFromLine, Ban } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetcher } from "@/lib/api";
import type { ProxySessionStub } from "@/types";
import { AppContainer } from "../_components/app-container";
import { AppHeader } from "../_components/app-header";
import { useGlobal } from "../_components/global-app-context";
import {
  ConfigProvider,
  useConfig,
} from "../history/_components/config-provider";
import { ConfigSelector } from "../history/_components/config-selector";
import { NoConfigsState } from "../history/_components/no-configs-state";
import { WithConfigsRecent } from "./_components/with-configs-recent";

function RecentPageContent() {
  const { allConfigs } = useGlobal();
  const { selectedConfigId, setSelectedConfigId } = useConfig();

  const activeConfigs = React.useMemo(
    () => allConfigs.filter((c) => c.is_proxyserver_active),
    [allConfigs],
  );

  const [startTime, setStartTime] = React.useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("recent_start_time");
      return saved ? Number.parseInt(saved) : Date.now();
    }
    return Date.now();
  });

  React.useEffect(() => {
    localStorage.setItem("recent_start_time", startTime.toString());
  }, [startTime]);

  // Filter and Search States
  const [filterMethod, setFilterMethod] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");

  const initLoadSessions = React.useCallback(
    async (configId: string, params: URLSearchParams) => {
      const startTimeIso = new Date(startTime).toISOString();
      // Keep existing filters from params
      const queryParams = new URLSearchParams(params);
      queryParams.set("since", startTimeIso);

      const url = `/api/sessions/recent/${configId}?${queryParams.toString()}`;
      const res = await fetcher(url);
      return res;
    },
    [startTime],
  );

  const mergeSessions = React.useCallback(
    (prev: ProxySessionStub[], session: ProxySessionStub) => {
      console.log("recent try merge:", session);
      const existingIndex = prev.findIndex((s) => s.ID === session.ID);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = session;
        return updated;
      }
      return [session, ...prev];
    },
    [],
  );

  const headTitle = "Recent Traffic";

  const handleResetStartTime = () => {
    setStartTime(Date.now());
  };

  // Show no configs state if no active configs available
  if (activeConfigs.length === 0) {
    return (
      <AppContainer>
        <AppHeader>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-primary">
              {headTitle}
            </h1>
          </div>
        </AppHeader>
        <NoConfigsState />
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      {/* Header */}
      <AppHeader>
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-xl font-bold tracking-tight whitespace-nowrap text-primary">
            {headTitle}
          </h1>
          <ConfigSelector
            configs={allConfigs}
            selectedConfigId={selectedConfigId}
            onConfigChange={setSelectedConfigId}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" onClick={handleResetStartTime}>
                <ArrowLeftFromLine className="w-4 h-4" /> Showing records from{" "}
                {format(new Date(startTime), "PP pp")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              clear recorded and start new recording
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-4"></div>
      </AppHeader>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <WithConfigsRecent
          key={startTime} // reset component state when startTime changes
          configId={selectedConfigId}
          searchQuery={""}
          filterMethod={filterMethod}
          filterStatus={filterStatus}
          onSearchQueryChange={() => {}}
          onFilterMethodChange={setFilterMethod}
          onFilterStatusChange={setFilterStatus}
          initLoadSessions={initLoadSessions}
          mergeSessions={mergeSessions}
        />
      </div>
    </AppContainer>
  );
}

export default function RecentPage() {
  return (
    <ConfigProvider mode="recent">
      <RecentPageContent />
    </ConfigProvider>
  );
}

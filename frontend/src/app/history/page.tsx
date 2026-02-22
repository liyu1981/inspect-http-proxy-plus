"use client";

import { RefreshCw, Search } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetcher } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DateTimeRange, ProxySessionStub } from "@/types";
import { DateTimeRangePicker } from "@/components/date-time-range-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { AppContainer } from "../_components/app-container";
import { AppHeader } from "../_components/app-header";
import { useGlobal } from "../_components/global-app-context";
import { ConfigProvider, useConfig } from "./_components/config-provider";
import { ConfigSelector } from "./_components/config-selector";
import { NoConfigsState } from "./_components/no-configs-state";
import { WithConfigsHistory } from "./_components/with-configs-history";

function InspectPageContent() {
  const { allConfigs } = useGlobal();
  const { selectedConfigId, setSelectedConfigId } = useConfig();
  const [mutateFunc, setMutateFunc] = React.useState<(() => void) | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);

  // Filter and Search States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterMethod, setFilterMethod] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [dateRange, setDateRange] = React.useState<DateTimeRange>({
    from: startOfDay(subDays(new Date(), 6)),
    to: endOfDay(new Date()),
  });

  const initLoadSessions = React.useCallback(
    async (configId: string, params: URLSearchParams) => {
      const q = params.get("q");
      const apiPath =
        q && q.length >= 3
          ? `/api/sessions/search/${configId}`
          : `/api/sessions/recent/${configId}`;
      
      if (dateRange.from) {
        params.set("since", dateRange.from.toISOString());
      }
      if (dateRange.to) {
        params.set("until", dateRange.to.toISOString());
      }

      return fetcher(`${apiPath}?${params.toString()}`);
    },
    [dateRange],
  );

  const mergeSessions = React.useCallback(
    (prev: ProxySessionStub[], session: ProxySessionStub) => {
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

  const handleMutate = React.useCallback((fn: () => void) => {
    setMutateFunc(() => fn);
  }, []);

  const handleRefresh = () => {
    if (mutateFunc) {
      mutateFunc();
    }
  };

  const headTitle = "History Traffic";

  const selectedConfig = React.useMemo(() => {
    return allConfigs.find((c) => c.config_row.ID === selectedConfigId);
  }, [allConfigs, selectedConfigId]);

  // Show no configs state if no configs available
  if (allConfigs.length === 0) {
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
          <DateTimeRangePicker
            initialDateFrom={dateRange.from}
            initialDateTo={dateRange.to}
            onUpdate={({ range }) => setDateRange(range)}
            className="ml-4 w-auto"
          />
          <div className="relative max-w-sm w-full ml-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search (3+ chars)..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={!mutateFunc}
              >
                <RefreshCw
                  className={cn("h-4 w-4", isValidating && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Manual Refresh Sessions Now</TooltipContent>
          </Tooltip>
        </div>
      </AppHeader>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedConfig && (
          <div className="bg-muted/30 border-b px-4 py-1.5 flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold uppercase opacity-60 text-[9px]">
                Proxy:
              </span>
              <span className="truncate font-mono text-primary/80">
                {(() => {
                  try {
                    const cfg = (typeof selectedConfig.config_row.ConfigJSON ===
                    "string"
                      ? JSON.parse(selectedConfig.config_row.ConfigJSON)
                      : selectedConfig.config_row
                          .ConfigJSON) as unknown as Record<string, unknown>;
                    return `${(cfg.listen as string) || (cfg.Listen as string) || "??"} 🠞 ${(cfg.target as string) || (cfg.Target as string) || "??"}`;
                  } catch (_e) {
                    return "invalid config";
                  }
                })()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold uppercase opacity-60 text-[9px]">
                Source:
              </span>
              <span className="truncate">
                {selectedConfig.config_row.SourcePath}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold uppercase opacity-60 text-[9px]">
                WorkDir:
              </span>
              <span className="truncate">{selectedConfig.config_row.Cwd}</span>
            </div>
          </div>
        )}
        <WithConfigsHistory
          configId={selectedConfigId}
          onMutate={handleMutate}
          onValidatingChange={setIsValidating}
          searchQuery={searchQuery}
          filterMethod={filterMethod}
          filterStatus={filterStatus}
          dateRange={dateRange}
          onSearchQueryChange={setSearchQuery}
          onFilterMethodChange={setFilterMethod}
          onFilterStatusChange={setFilterStatus}
          initLoadSessions={initLoadSessions}
          mergeSessions={mergeSessions}
        />
      </div>
    </AppContainer>
  );
}

export default function InspectPage() {
  return (
    <ConfigProvider mode="history">
      <InspectPageContent />
    </ConfigProvider>
  );
}

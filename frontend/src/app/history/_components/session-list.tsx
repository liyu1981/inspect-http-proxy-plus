"use client";

import { format, formatDistanceToNow } from "date-fns";
import { FilterX, Loader2, X } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ProxySessionStub } from "@/types";

interface SessionListProps {
  sessions: ProxySessionStub[];
  selectedSessionId: string | null;
  filterMethod: string;
  filterStatus: string;
  searchQuery: string;
  totalLoaded: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onSessionClick: (id: string) => void;
  onFilterMethodChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
}

export function SessionList({
  sessions,
  selectedSessionId,
  filterMethod,
  filterStatus,
  searchQuery,
  totalLoaded,
  hasMore,
  isLoadingMore,
  onSessionClick,
  onFilterMethodChange,
  onFilterStatusChange,
  onClearFilters,
  onLoadMore,
}: SessionListProps) {
  // Get unique methods and statuses from loaded sessions
  const availableMethods = React.useMemo(() => {
    const methods = new Set(sessions.map((s) => s.RequestMethod));
    return Array.from(methods).sort();
  }, [sessions]);

  const availableStatuses = React.useMemo(() => {
    const statuses = new Set(
      sessions.map((s) => s.ResponseStatusCode.toString()),
    );
    return Array.from(statuses).sort();
  }, [sessions]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto relative">
        <Table noWrapper className="border-separate border-spacing-0">
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px] p-0 h-16 sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#1e293b]">
                <Select
                  value={filterStatus || "all_statuses"}
                  onValueChange={(val) =>
                    onFilterStatusChange(val === "all_statuses" ? "" : val)
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "h-16 w-full border-none rounded-none focus:ring-0 bg-transparent px-2 py-0 hover:bg-muted/50 transition-colors flex flex-col items-start justify-center gap-0 [&_svg]:hidden",
                      filterStatus && "text-primary",
                    )}
                  >
                    <span className="text-[9px] opacity-60 font-semibold leading-normal">
                      Status
                    </span>
                    <div className="text-[11px] font-bold leading-normal w-full text-left">
                      <SelectValue placeholder="All" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_statuses">All</SelectItem>
                    {availableStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableHead>
              <TableHead className="w-[110px] p-0 h-16 sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#1e293b]">
                <Select
                  value={filterMethod || "all_methods"}
                  onValueChange={(val) =>
                    onFilterMethodChange(val === "all_methods" ? "" : val)
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "h-16 w-full border-none rounded-none focus:ring-0 bg-transparent px-2 py-0 hover:bg-muted/50 transition-colors flex flex-col items-start justify-center gap-0 [&_svg]:hidden",
                      filterMethod && "text-primary",
                    )}
                  >
                    <span className="text-[9px] opacity-60 font-semibold leading-normal">
                      Method
                    </span>
                    <div className="text-[11px] font-bold leading-normal w-full text-left">
                      <SelectValue placeholder="All" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_methods">All</SelectItem>
                    {availableMethods.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableHead>{" "}
              <TableHead className="h-16 sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#1e293b]">
                Path
              </TableHead>
              <TableHead className="w-[100px] h-16 text-right sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#1e293b]">
                Latency
              </TableHead>
              <TableHead className="w-[140px] h-16 text-right sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#1e293b]">
                <div className="flex items-center justify-end gap-2">
                  {(filterMethod || filterStatus || searchQuery) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClearFilters}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      title="Clear all filters"
                    >
                      <FilterX className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <span>Time</span>
                </div>
              </TableHead>{" "}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions?.map((session) => (
              <SessionRow
                key={session.ID}
                session={session}
                isSelected={selectedSessionId === session.ID}
                onClick={() => onSessionClick(session.ID)}
              />
            ))}
            {!sessions?.length && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center border-b">
                  No sessions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer Area */}
      <div className="border-t px-4 py-3 bg-background flex items-center justify-between flex-shrink-0">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{totalLoaded}</span>{" "}
          session{totalLoaded !== 1 ? "s" : ""} loaded
        </div>

        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="h-8 gap-2"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        )}

        {!hasMore && totalLoaded > 0 && (
          <span className="text-xs text-muted-foreground">
            All sessions loaded
          </span>
        )}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isSelected,
  onClick,
}: {
  session: ProxySessionStub;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <TableRow
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "bg-muted",
      )}
      onClick={onClick}
    >
      <TableCell className="py-2 border-b">
        <StatusBadge code={session.ResponseStatusCode} />
      </TableCell>
      <TableCell className="py-2 border-b">
        <span className="font-mono font-bold text-[11px] uppercase">
          {session.RequestMethod}
        </span>
      </TableCell>
      <TableCell className="py-2 border-b">
        <div
          className="max-w-[300px] truncate font-mono text-[11px] text-muted-foreground"
          title={session.RequestPath}
        >
          {session.RequestPath}
        </div>
      </TableCell>
      <TableCell className="py-2 text-right text-[11px] font-mono text-muted-foreground border-b">
        {session.DurationMs > 0 ? `${session.DurationMs}ms` : "-"}
      </TableCell>
      <TableCell className="py-2 text-right text-xs text-muted-foreground whitespace-nowrap border-b">
        <div className="font-medium text-foreground">
          {formatDistanceToNow(new Date(session.Timestamp), {
            addSuffix: true,
          })}
        </div>
        <div className="text-[10px] opacity-70">
          {format(new Date(session.Timestamp), "MM-dd HH:mm:ss")}
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ code }: { code: number }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let className = "";

  if (code === 0) {
    variant = "outline";
    return (
      <Badge variant={variant} className="animate-pulse">
        Pending
      </Badge>
    );
  }

  if (code >= 200 && code < 300) {
    variant = "secondary";
    className =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200";
  } else if (code >= 300 && code < 400) {
    variant = "secondary";
    className =
      "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400 border-blue-200";
  } else if (code >= 400) {
    variant = "destructive";
  }

  return (
    <Badge
      variant={variant}
      className={cn("font-mono text-[10px] px-1.5 h-5", className)}
    >
      {code}
    </Badge>
  );
}

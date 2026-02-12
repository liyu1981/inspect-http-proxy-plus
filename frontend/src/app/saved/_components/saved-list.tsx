"use client";

import { format } from "date-fns";
import { Loader2, Tag, Trash2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProxyBookmark } from "@/types";
import { StatusBadge } from "../../history/_components/status-badge";

interface SavedListProps {
  bookmarks: ProxyBookmark[];
  selectedBookmarkId: string | null;
  filterMethod: string;
  filterStatus: string;
  searchQuery: string;
  totalLoaded: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onBookmarkClick: (id: string) => void;
  onFilterMethodChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onDelete: (id: string) => void;
}

export function SavedList({
  bookmarks,
  selectedBookmarkId,
  filterMethod,
  filterStatus,
  searchQuery,
  totalLoaded,
  hasMore,
  isLoadingMore,
  onBookmarkClick,
  onFilterMethodChange,
  onFilterStatusChange,
  onClearFilters,
  onLoadMore,
  onDelete,
}: SavedListProps) {
  const availableMethods = React.useMemo(() => {
    const methods = new Set(bookmarks.map((b) => b.RequestMethod));
    return Array.from(methods).sort();
  }, [bookmarks]);

  const availableStatuses = React.useMemo(() => {
    const statuses = new Set(
      bookmarks.map((b) => b.ResponseStatusCode.toString()),
    );
    return Array.from(statuses).sort();
  }, [bookmarks]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b px-6 py-2 flex items-center gap-2 bg-muted/40 flex-shrink-0 justify-end">
        <Select
          value={filterMethod || "all_methods"}
          onValueChange={(val) =>
            onFilterMethodChange(val === "all_methods" ? "" : val)
          }
        >
          <SelectTrigger className="w-[110px] h-8 text-[11px]">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_methods">All Methods</SelectItem>
            {availableMethods.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterStatus || "all_statuses"}
          onValueChange={(val) =>
            onFilterStatusChange(val === "all_statuses" ? "" : val)
          }
        >
          <SelectTrigger className="w-[100px] h-8 text-[11px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_statuses">All Status</SelectItem>
            {availableStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterMethod || filterStatus || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 ml-auto text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <Table noWrapper className="border-separate border-spacing-0">
          <TableBody>
            {bookmarks?.map((bookmark) => (
              <SavedRow
                key={bookmark.ID}
                bookmark={bookmark}
                isSelected={selectedBookmarkId === bookmark.ID}
                onClick={() => onBookmarkClick(bookmark.ID)}
                onDelete={() => onDelete(bookmark.ID)}
              />
            ))}
            {!bookmarks?.length && (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center border-b">
                  No saved sessions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="border-t px-4 py-3 bg-background flex items-center justify-between flex-shrink-0">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{totalLoaded}</span>{" "}
          saved session{totalLoaded !== 1 ? "s" : ""} loaded
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
      </div>
    </div>
  );
}

function SavedRow({
  bookmark,
  isSelected,
  onClick,
  onDelete,
}: {
  bookmark: ProxyBookmark;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const tagsList = bookmark.Tags
    ? bookmark.Tags.split(" ")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const requestedTime = format(
    new Date(bookmark.Timestamp),
    "yyyy-MM-dd HH:mm:ss",
  );
  const savedTime = format(new Date(bookmark.CreatedAt), "yyyy-MM-dd HH:mm:ss");

  return (
    <TableRow
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors group",
        isSelected && "bg-muted",
      )}
      onClick={onClick}
    >
      <TableCell className="py-3 border-b align-top w-[60px]">
        <StatusBadge code={bookmark.ResponseStatusCode} />
      </TableCell>
      <TableCell className="py-3 border-b">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="font-mono break-all">
              <span className="font-bold uppercase mr-2 text-foreground">
                {bookmark.RequestMethod}
              </span>
              <span className="mr-2">
                {bookmark.ConfigJSON
                  ? JSON.parse(bookmark.ConfigJSON).Target
                  : ""}
              </span>
              <span className="text-muted-foreground">
                {bookmark.RequestURLFull}
              </span>
            </div>

            <div className="flex flex-col text-muted-foreground mt-1 gap-0.5">
              <div>requested time: {requestedTime}</div>
              <div>saved time: {savedTime}</div>
            </div>

            {tagsList.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tagsList.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="px-2 py-2 h-6 bg-primary text-background space-x-2"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Delete</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

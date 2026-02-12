"use client";

import * as React from "react";
import useSWR from "swr";
import { useDebounced } from "@/app/_hooks/use-debounced";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { api } from "@/lib/api";
import type { BookmarkListResponse, ProxyBookmark } from "@/types";
import { useSubscription } from "../../_hooks/use-subscription";
import { SavedDetails } from "./saved-details";
import { SavedList } from "./saved-list";

const getBookmarks = async (params: {
  config_id?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) => {
  const res = await api.get("/api/bookmarks", { params });
  return res.data;
};

const deleteBookmark = async (id: string) => {
  const res = await api.delete(`/api/bookmarks/${id}`);
  return res.data;
};

interface SavedPageProps {
  onMutate: (mutate: () => void) => void;
  onValidatingChange: (isValidating: boolean) => void;
  searchQuery: string;
  filterMethod: string;
  filterStatus: string;
  onSearchQueryChange: (val: string) => void;
  onFilterMethodChange: (val: string) => void;
  onFilterStatusChange: (val: string) => void;
}

export function SavedPage({
  onMutate,
  onValidatingChange,
  searchQuery,
  filterMethod,
  filterStatus,
  onSearchQueryChange,
  onFilterMethodChange,
  onFilterStatusChange,
}: SavedPageProps) {
  const [selectedBookmarkId, setSelectedBookmarkId] = React.useState<
    string | null
  >(null);

  const [debouncedSearchQuery, _setDebouncedSearchQuery] = useDebounced(
    searchQuery,
    500,
  );

  const [allLoadedBookmarks, setAllLoadedBookmarks] = React.useState<
    ProxyBookmark[]
  >([]);

  const [offset, setOffset] = React.useState<number>(0);
  const [limit] = React.useState<number>(50);
  const [isLoadingMore, setIsLoadingMore] = React.useState<boolean>(false);

  // Fetching logic: config_id is omitted to fetch ALL saved sessions
  const {
    data: bookmarkList,
    mutate,
    isValidating,
  } = useSWR<BookmarkListResponse>(
    ["bookmarks", debouncedSearchQuery, filterMethod, filterStatus, offset],
    () =>
      getBookmarks({
        q: debouncedSearchQuery,
        limit,
        offset,
      }),
    {
      revalidateOnFocus: false,
    },
  );

  // Pass mutate function to parent
  React.useEffect(() => {
    onMutate(() => mutate());
  }, [mutate, onMutate]);

  // Pass isValidating to parent
  React.useEffect(() => {
    onValidatingChange(isValidating);
  }, [isValidating, onValidatingChange]);

  // Merge logic
  React.useEffect(() => {
    if (bookmarkList?.bookmarks) {
      if (offset === 0) {
        setAllLoadedBookmarks(bookmarkList.bookmarks);
        // Auto-select first if nothing selected
        if (bookmarkList.bookmarks.length > 0 && !selectedBookmarkId) {
          setSelectedBookmarkId(bookmarkList.bookmarks[0].ID);
        }
      } else {
        setAllLoadedBookmarks((prev) => {
          const newBookmarks = bookmarkList.bookmarks.filter(
            (nb) => !prev.some((b) => b.ID === nb.ID),
          );
          return [...prev, ...newBookmarks];
        });
      }
      setIsLoadingMore(false);
    }
  }, [bookmarkList, offset, selectedBookmarkId]);

  // Reset offset when filters change
  React.useEffect(() => {
    setOffset(0);
  }, []);

  useSubscription(
    "saved_sessions",
    ({ type, bookmark }: { type: string; bookmark: ProxyBookmark }) => {
      if (type === "update_session" && bookmark) {
        setAllLoadedBookmarks((prev) =>
          prev.map((b) => (b.ID === bookmark.ID ? bookmark : b)),
        );
      }
    },
  );

  const hasMore = bookmarkList?.bookmarks?.length === limit;

  const handleBookmarkClick = (id: string) => {
    setSelectedBookmarkId(id);
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setOffset((prev) => prev + limit);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to unsave this session?")) return;
    try {
      await deleteBookmark(id);
      if (selectedBookmarkId === id) {
        setSelectedBookmarkId(null);
      }
      mutate();
    } catch (err) {
      console.error("Failed to unsave session", err);
    }
  };

  return (
    <ResizablePanelGroup orientation="horizontal">
      {/* List Panel */}
      <ResizablePanel defaultSize="40%" minSize="30%" maxSize="50%">
        <SavedList
          bookmarks={allLoadedBookmarks}
          selectedBookmarkId={selectedBookmarkId}
          filterMethod={filterMethod}
          filterStatus={filterStatus}
          searchQuery={searchQuery}
          totalLoaded={allLoadedBookmarks.length}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onBookmarkClick={handleBookmarkClick}
          onFilterMethodChange={onFilterMethodChange}
          onFilterStatusChange={onFilterStatusChange}
          onClearFilters={() => {
            onFilterMethodChange("");
            onFilterStatusChange("");
            onSearchQueryChange("");
          }}
          onLoadMore={handleLoadMore}
          onDelete={handleDelete}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Details Panel */}
      <ResizablePanel defaultSize="60%">
        <div className="h-full bg-muted/10">
          {selectedBookmarkId ? (
            <SavedDetails id={selectedBookmarkId} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <p>Select a saved session to view details</p>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useDebounced } from "@/app/_hooks/use-debounced";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs } from "@/components/ui/tabs";
import { api, fetcher } from "@/lib/api";
import type { ProxyBookmark } from "@/types";
import { useSubscription } from "../../_hooks/use-subscription";
import { SavedMetadataEditor } from "./saved-metadata-editor";
import { SavedSessionInfo } from "./saved-session-info";

const updateBookmark = async (
  id: string,
  data: { note: string; tags: string },
) => {
  const res = await api.patch(`/api/bookmarks/${id}`, data);
  return res.data;
};

function tagsToString(tags: string[]) {
  return tags.join(" ");
}

interface SavedDetailsProps {
  id: string;
}

export function SavedDetails({ id }: SavedDetailsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // dirtyRef tracks if there are unsaved changes
  const dirtyRef = useRef(false);

  // Use a longer debounce for auto-saving during edit (2 seconds)
  const [debouncedNote] = useDebounced(note, 2000);
  const [debouncedTags] = useDebounced(tagsToString(tags), 2000);

  const {
    data: bookmark,
    error,
    mutate,
  } = useSWR<ProxyBookmark>(id ? `/api/bookmarks/${id}` : null, fetcher);

  // Initial load and sync from server
  useEffect(() => {
    // Only sync from SWR if we are not editing AND we don't have unsaved local changes
    if (bookmark && !isEditing && !dirtyRef.current) {
      setNote(bookmark.Note || "");
      const tagArray = bookmark.Tags
        ? bookmark.Tags.split(" ")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      setTags(tagArray);
    }
  }, [bookmark, isEditing]); // Removed id as bookmark already changes when switching

  const handleUpdate = useCallback(async () => {
    if (!dirtyRef.current) return;

    setIsSaving(true);
    try {
      const updated = await updateBookmark(id, {
        note,
        tags: tagsToString(tags),
      });
      setLastSavedAt(new Date());
      dirtyRef.current = false;
      // Update local SWR cache with the response
      mutate(updated, false);
    } catch (err) {
      console.error("Failed to update saved session", err);
    } finally {
      setIsSaving(false);
    }
  }, [id, note, tags, mutate]);

  // Handle periodic auto-save when debounced values change
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleUpdate is already debounced via these values
  useEffect(() => {
    if (dirtyRef.current) {
      handleUpdate();
    }
  }, [debouncedNote, debouncedTags]);

  // Handle immediate save on blur
  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (dirtyRef.current) {
      handleUpdate();
    }
  }, [handleUpdate]);

  useSubscription(
    "saved_sessions",
    ({
      type,
      bookmark: updatedBookmark,
    }: {
      type: string;
      bookmark: ProxyBookmark;
    }) => {
      // ONLY update if we are not currently editing AND not dirty to avoid loops and race conditions
      if (
        !isEditing &&
        !dirtyRef.current &&
        type === "update_session" &&
        updatedBookmark &&
        updatedBookmark.ID === id
      ) {
        if (updatedBookmark.Note !== note) {
          setNote(updatedBookmark.Note || "");
        }
        const updatedTags = updatedBookmark.Tags
          ? updatedBookmark.Tags.split(" ")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
        if (tagsToString(updatedTags) !== tagsToString(tags)) {
          setTags(updatedTags);
        }
      }
    },
  );

  if (error)
    return (
      <div className="p-8 text-destructive">
        Failed to load saved session details
      </div>
    );
  if (!bookmark)
    return <div className="p-8 text-muted-foreground">Loading details...</div>;

  return (
    <div className="h-full">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize="70%" minSize="30%">
          <SavedSessionInfo bookmark={bookmark} />
        </ResizablePanel>

        <ResizableHandle withHandle className="w-full h-[1px]" />

        <ResizablePanel defaultSize="30%" minSize="20%">
          <SavedMetadataEditor
            note={note}
            setNote={(val) => {
              setNote(val);
              dirtyRef.current = true;
            }}
            tags={tags}
            setTags={(val) => {
              setTags(val);
              dirtyRef.current = true;
            }}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onBlur={handleBlur}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

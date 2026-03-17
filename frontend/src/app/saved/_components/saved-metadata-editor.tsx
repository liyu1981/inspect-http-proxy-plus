"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownPreview } from "../../_components/markdown-preview";
import { TagInput } from "../../_components/tag-input";

interface SavedMetadataEditorProps {
  note: string;
  setNote: (val: string) => void;
  tags: string[];
  setTags: (val: string[]) => void;
  isSaving: boolean;
  lastSavedAt: Date | null;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  onBlur: () => void;
}

export function SavedMetadataEditor({
  note,
  setNote,
  tags,
  setTags,
  isSaving,
  lastSavedAt,
  isEditing,
  setIsEditing,
  onBlur,
}: SavedMetadataEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              Tags & Notes
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isSaving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              ) : lastSavedAt ? (
                <span>Last saved at {format(lastSavedAt, "HH:mm:ss")}</span>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Tags (Press Space to add)
            </Label>
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder="e.g. auth bug"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Note (Markdown supported)
            </Label>
            <div className="min-h-[150px] relative group">
              {isEditing ? (
                <Textarea
                  ref={textareaRef}
                  placeholder="Add some context about this session (Markdown supported)..."
                  className="min-h-[150px] font-mono text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={onBlur}
                />
              ) : (
                <div
                  className="min-h-[150px] p-3 rounded-md border bg-muted/20 cursor-text hover:border-primary/50 transition-colors"
                  onClick={() => setIsEditing(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setIsEditing(true);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Edit note"
                >
                  <MarkdownPreview content={note} />
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

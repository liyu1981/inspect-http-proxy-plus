/** biome-ignore-all lint/a11y/useKeyWithClickEvents: tag input component */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: tag input component */
"use client";

import { X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[], newTag?: string) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  tags,
  onChange,
  placeholder,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleAddTag = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    // Deduplicate
    if (tags.includes(trimmed)) {
      setInputValue("");
      return;
    }

    const newTags = [...tags, trimmed];
    onChange(newTags, trimmed);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      const newTags = tags.slice(0, -1);
      onChange(newTags);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    onChange(newTags);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 p-1.5 min-h-10 w-full rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="flex items-center gap-1 pl-2 pr-1 py-0.5 h-6 animate-in fade-in zoom-in duration-200"
        >
          <span className="max-w-[150px] truncate">{tag}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="rounded-full outline-none hover:bg-muted p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove {tag}</span>
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => handleAddTag(inputValue)}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 bg-transparent border-none outline-none placeholder:text-muted-foreground min-w-[80px] h-6 py-0 px-1"
      />
    </div>
  );
}

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
import { cn } from "@/lib/utils";
import { AppContainer } from "../_components/app-container";
import { AppHeader } from "../_components/app-header";
import { SavedPage as SavedContent } from "./_components/saved-page";

function SavedRoot() {
  const [mutateFunc, setMutateFunc] = React.useState<(() => void) | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);

  // Filter and Search States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterMethod, setFilterMethod] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");

  const handleMutate = React.useCallback((fn: () => void) => {
    setMutateFunc(() => fn);
  }, []);

  const handleRefresh = () => {
    if (mutateFunc) {
      mutateFunc();
    }
  };

  const headTitle = "Saved Traffic";

  return (
    <AppContainer>
      {/* Header */}
      <AppHeader>
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-xl font-bold tracking-tight whitespace-nowrap text-primary">
            {headTitle}
          </h1>
          <div className="relative max-w-md w-full ml-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in saved (3+ chars)..."
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
            <TooltipContent>Manual Refresh Saved Now</TooltipContent>
          </Tooltip>
        </div>
      </AppHeader>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <SavedContent
          onMutate={handleMutate}
          onValidatingChange={setIsValidating}
          searchQuery={searchQuery}
          filterMethod={filterMethod}
          filterStatus={filterStatus}
          onSearchQueryChange={setSearchQuery}
          onFilterMethodChange={setFilterMethod}
          onFilterStatusChange={setFilterStatus}
        />
      </div>
    </AppContainer>
  );
}

export default function Saved() {
  return <SavedRoot />;
}

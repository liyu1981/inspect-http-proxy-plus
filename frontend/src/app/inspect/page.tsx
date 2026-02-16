"use client";

import { RefreshCw } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AppContainer } from "../_components/app-container";
import { AppHeader } from "../_components/app-header";
import { useGlobal } from "../_components/global-app-context";
import { ConfigProvider, useConfig } from "./_components/config-provider";
import { ConfigSelector } from "./_components/config-selector";
import { NoConfigsState } from "./_components/no-configs-state";
import { WithConfigsState } from "./_components/with-configs-state";

function InspectPageContent() {
  const { allConfigs } = useGlobal();
  const { selectedConfigId, setSelectedConfigId } = useConfig();
  const [mutateFunc, setMutateFunc] = React.useState<(() => void) | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);

  const handleMutate = React.useCallback((fn: () => void) => {
    setMutateFunc(() => fn);
  }, []);

  const handleRefresh = () => {
    if (mutateFunc) {
      mutateFunc();
    }
  };

  const headTitle = "Inspect Traffic";

  // Show no configs state if no configs available
  if (allConfigs.length === 0) {
    return (
      <AppContainer>
        <AppHeader>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{headTitle}</h1>
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
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">{headTitle}</h1>
          <ConfigSelector
            configs={allConfigs}
            selectedConfigId={selectedConfigId}
            onConfigChange={setSelectedConfigId}
          />
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
      <div className="flex-1 overflow-hidden">
        <WithConfigsState
          onMutate={handleMutate}
          onValidatingChange={setIsValidating}
        />
      </div>
    </AppContainer>
  );
}

export default function InspectPage() {
  return (
    <ConfigProvider>
      <InspectPageContent />
    </ConfigProvider>
  );
}

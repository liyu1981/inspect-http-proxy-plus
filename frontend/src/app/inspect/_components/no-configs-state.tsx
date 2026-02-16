"use client";

import { Settings } from "lucide-react";

export function NoConfigsState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <Settings className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">No Active Configurations</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            No proxy configurations are currently active. Please create or
            activate a configuration to start inspecting sessions.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { AppContainer } from "../_components/app-container";
import { AppHeader } from "../_components/app-header";
import { useGlobal } from "../_components/global-app-context";
import { ConfigCard } from "./_components/config-card";

export default function ConfigsPage() {
  const { allConfigs, isLoading } = useGlobal();

  return (
    <AppContainer>
      <AppHeader>
        <div className="flex items-center justify-between w-full">
          <h1 className="text-xl font-bold tracking-tight text-primary">Proxy Servers</h1>
        </div>
      </AppHeader>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-6">
            {isLoading ? (
              <div className="p-10 border border-dashed rounded-xl text-center text-muted-foreground animate-pulse">
                Loading...
              </div>
            ) : allConfigs.length === 0 ? (
              <div className="p-10 border border-dashed rounded-xl text-center text-muted-foreground bg-muted/20">
                No active proxy configs.
              </div>
            ) : (
              allConfigs.map((config) => (
                <ConfigCard key={config.id} config={config} />
              ))
            )}
          </div>
        </div>
      </div>
    </AppContainer>
  );
}

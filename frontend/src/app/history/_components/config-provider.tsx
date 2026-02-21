"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useGlobal } from "@/app/_components/global-app-context";

interface ConfigContextType {
  mode: string;
  selectedConfigId: string;
  setSelectedConfigId: (id: string) => void;
}

const ConfigContext = React.createContext<ConfigContextType | undefined>(
  undefined,
);

/**
 * Inner component to handle search params logic safely within Suspense
 */
function ConfigProviderInner({
  mode,
  children,
}: {
  mode: string;
  children: React.ReactNode;
}) {
  const { allConfigs } = useGlobal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedConfigId, setSelectedConfigIdState] = React.useState<string>(
    allConfigs.length > 0 ? allConfigs[0].config_row.ID : "",
  );

  const updateURLConfigId = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("config_id", id);
      router.replace(`/${mode}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, mode],
  );

  // Initialize from URL on mount or when configs change
  React.useEffect(() => {
    const configIdFromUrl = searchParams.get("config_id");

    if (configIdFromUrl) {
      // If the state is already synced, don't update to avoid unnecessary re-renders
      if (selectedConfigId !== configIdFromUrl) {
        setSelectedConfigIdState(configIdFromUrl);
      }
      return;
    }

    // Defaulting logic: If no config_id in URL, use the first one available
    if (allConfigs.length > 0) {
      let defaultId = allConfigs[0].config_row.ID;

      // For recent mode, try to find the first active config
      if (mode === "recent") {
        const activeConfig = allConfigs.find((c) => c.is_proxyserver_active);
        if (activeConfig) {
          defaultId = activeConfig.config_row.ID;
        }
      }

      setSelectedConfigIdState(defaultId);
      updateURLConfigId(defaultId);
    }
  }, [searchParams, allConfigs, updateURLConfigId, selectedConfigId]);

  const setSelectedConfigId = React.useCallback(
    (id: string) => {
      setSelectedConfigIdState(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("config_id", id);
      router.push(`/${mode}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, mode],
  );

  return (
    <ConfigContext.Provider
      value={{ mode, selectedConfigId, setSelectedConfigId }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * Main Provider wrapped in Suspense to prevent Next.js build bail-out
 */
export function ConfigProvider({
  mode,
  children,
}: {
  mode: string;
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={null}>
      <ConfigProviderInner mode={mode}>{children}</ConfigProviderInner>
    </React.Suspense>
  );
}

export function useConfig() {
  const context = React.useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}

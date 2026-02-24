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

  // Initialize from URL or localStorage on mount or when configs change
  React.useEffect(() => {
    if (allConfigs.length === 0) return;

    const configIdFromUrl = searchParams.get("config_id");
    const persistentId = localStorage.getItem("selected-config-id");

    if (configIdFromUrl) {
      // Validate that it exists
      const exists = allConfigs.some(
        (c) => c.config_row.ID === configIdFromUrl,
      );
      if (exists) {
        if (selectedConfigId !== configIdFromUrl) {
          setSelectedConfigIdState(configIdFromUrl);
        }
        // Always sync to localStorage if it's in URL and valid
        if (persistentId !== configIdFromUrl) {
          localStorage.setItem("selected-config-id", configIdFromUrl);
        }
        return;
      }
      // If configId from URL doesn't exist, proceed to defaults
    }

    // No valid ID in URL, check localStorage
    if (persistentId) {
      const exists = allConfigs.some((c) => c.config_row.ID === persistentId);
      if (exists) {
        setSelectedConfigIdState(persistentId);
        updateURLConfigId(persistentId);
        return;
      }
    }

    // Defaulting logic: If no config_id in URL or localStorage, use the first one available
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
    localStorage.setItem("selected-config-id", defaultId);
  }, [searchParams, allConfigs, updateURLConfigId, selectedConfigId, mode]);

  const setSelectedConfigId = React.useCallback(
    (id: string) => {
      setSelectedConfigIdState(id);
      localStorage.setItem("selected-config-id", id);
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

import type React from "react";
import { createContext, useContext } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { ProxyConfig } from "@/types";

interface GlobalContextType {
  allConfigs: ProxyConfig[];
  sysConfig: any;
  isLoading: boolean;
  refreshConfigs: () => void;
  error: any;
}

const GlobalAppContext = createContext<GlobalContextType | undefined>(
  undefined,
);

export function GlobalAppProvider({ children }: { children: React.ReactNode }) {
  // Extract isLoading and error from SWR
  const {
    data: configs,
    isLoading: isConfigsLoading,
    error: configsError,
    mutate: mutateConfigs,
  } = useSWR<ProxyConfig[]>("/api/configs", fetcher, {
    revalidateOnFocus: false,
  });

  const {
    data: sysConfig,
    isLoading: isSysLoading,
    mutate: mutateSys,
  } = useSWR<any>("/api/sysconfig", fetcher, {
    revalidateOnFocus: false,
  });

  const refreshConfigs = () => {
    mutateConfigs();
    mutateSys();
  };

  return (
    <GlobalAppContext.Provider
      value={{
        allConfigs: configs ?? [],
        sysConfig,
        isLoading: isConfigsLoading || isSysLoading,
        refreshConfigs,
        error: configsError,
      }}
    >
      {children}
    </GlobalAppContext.Provider>
  );
}

export function useGlobal() {
  const context = useContext(GlobalAppContext);
  if (context === undefined) {
    throw new Error("useGlobal must be used within a GlobalAppProvider");
  }
  return context;
}

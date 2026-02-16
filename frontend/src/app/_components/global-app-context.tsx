import type React from "react";
import { createContext, useContext } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { ProxyConfig } from "@/types";

interface GlobalContextType {
  allConfigs: ProxyConfig[];
  isLoading: boolean;
  error: any;
}

const GlobalAppContext = createContext<GlobalContextType | undefined>(
  undefined,
);

export function GlobalAppProvider({ children }: { children: React.ReactNode }) {
  // Extract isLoading and error from SWR
  const {
    data: configs,
    isLoading,
    error,
  } = useSWR<ProxyConfig[]>("/api/configs/current", fetcher, {
    revalidateOnFocus: false,
  });

  return (
    <GlobalAppContext.Provider
      value={{
        allConfigs: configs ?? [],
        isLoading,
        error,
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

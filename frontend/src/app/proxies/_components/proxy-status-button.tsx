// app/_components/proxy-status-button.tsx
/** biome-ignore-all lint/suspicious/noExplicitAny: necessary */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProxyStatusButtonProps {
  configId: string;
  isActive: boolean;
  onStatusChange?: () => void;
}

export function ProxyStatusButton({
  configId,
  isActive,
  onStatusChange,
}: ProxyStatusButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);

    try {
      const endpoint = checked
        ? `/api/proxyserver/${configId}/start`
        : `/api/proxyserver/${configId}/stop`;

      const response = await api.post(endpoint);

      toast.success(checked ? "Proxy Server Started" : "Proxy Server Stopped", {
        description: `Config ID: ${response.data.config_id}`,
      });

      // Trigger refresh of parent component
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error: any) {
      console.error("Error toggling proxy server:", error);

      // Extract error message from axios error
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to toggle proxy server";

      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground",
        )}
      >
        {isActive ? "Active" : "Inactive"}
      </div>
      <Switch
        id={`proxy-${configId}`}
        checked={isActive}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        className={cn(
          isActive
            ? "data-[state=checked]:bg-primary"
            : "data-[state=unchecked]:bg-muted",
        )}
      />
    </div>
  );
}

// app/_components/proxy-status-button.tsx
/** biome-ignore-all lint/suspicious/noExplicitAny: necessary */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

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
    <div className="flex items-center gap-2">
      <Label
        htmlFor={`proxy-${configId}`}
        className={`text-sm font-medium cursor-pointer ${
          isActive ? "text-green-600" : "text-red-600"
        }`}
      >
        {isActive ? "Active" : "Inactive"}
      </Label>
      <Switch
        id={`proxy-${configId}`}
        checked={isActive}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        className={
          isActive
            ? "data-[state=checked]:bg-green-500"
            : "data-[state=unchecked]:bg-red-500"
        }
      />
    </div>
  );
}

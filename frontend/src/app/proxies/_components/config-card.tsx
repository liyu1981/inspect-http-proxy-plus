"use client";

import { AlertCircle, Clock, Folder, Hash, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { JsonEditor } from "@/app/_components/json-editor";
import { formatConfigDisplayName } from "@/app/inspect/_components/config-selector";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { ProxyConfig } from "@/types";
import { ProxyStatusButton } from "./proxy-status-button";

export function ConfigCard({ config: initialConfig }: { config: ProxyConfig }) {
  const [config, setConfig] = useState(initialConfig);

  // Parse the ConfigJSON string inside the component
  const parsedData = useMemo(() => {
    try {
      return JSON.parse(config.config_row.ConfigJSON);
    } catch (err) {
      console.error("Failed to parse ConfigJSON for ID:", config.id, err);
      return { error: "Invalid JSON format stored in database" };
    }
  }, [config]);

  const handleStatusChange = async () => {
    // Refetch the config to get updated status
    try {
      const response = await api.get(`/api/configs/${config.id}`);
      setConfig(response.data);
    } catch (error) {
      console.error("Failed to refresh config:", error);
    }
  };

  return (
    <div className="overflow-hidden">
      <Card className="pt-0">
        <CardHeader className="pt-6 border-b bg-muted/50 text-lg">
          <div>
            <div className="float float-right">
              <ProxyStatusButton
                configId={config.id}
                isActive={config.is_proxyserver_active}
                onStatusChange={handleStatusChange}
              />
            </div>
            {formatConfigDisplayName(config)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Hash className="h-3 w-3" /> Config ID
              </p>
              <code className="text-sm font-mono block text-primary font-semibold">
                {config.id}
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Folder className="h-3 w-3" /> Paths
              </p>
              <div className="text-xs space-y-0.5">
                <p
                  className="truncate font-medium"
                  title={config.config_row.SourcePath}
                >
                  <span className="text-muted-foreground">SRC:</span>{" "}
                  {config.config_row.SourcePath}
                </p>
                <p
                  className="truncate font-medium"
                  title={config.config_row.Cwd}
                >
                  <span className="text-muted-foreground">CWD:</span>{" "}
                  {config.config_row.Cwd}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Clock className="h-3 w-3" /> Created At
              </p>
              <p className="text-xs font-medium">
                {new Date(config.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* JSON Viewer */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" />
                Config As JSON
              </div>
              {parsedData.error && (
                <span className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Parse Error
                </span>
              )}
            </div>
            <div className="rounded-md border bg-muted/50 overflow-hidden">
              <JsonEditor
                initialJson={parsedData}
                rootFontSize={"13px"}
                viewOnly={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

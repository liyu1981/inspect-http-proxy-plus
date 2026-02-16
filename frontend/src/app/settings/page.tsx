"use client";

import { AlertCircle, Database, Network, Server, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { AppContainer } from "../_components/app-container";
import { AppHeader } from "../_components/app-header";
import { JsonEditor } from "../_components/json-editor";

interface ProxyEntry {
  listen: string;
  target: string;
  truncate_log_body: boolean;
}

interface SysConfig {
  log_level: string;
  db_path: string;
  api_addr: string;
  proxies: ProxyEntry[];
}

export default function SettingsPage() {
  const [sysConfig, setSysConfig] = useState<SysConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSysConfig = async () => {
      try {
        const response = await api.get("/api/sysconfig");
        setSysConfig(response.data);
      } catch (err) {
        console.error("Failed to fetch system config:", err);
        setError("Failed to load system configuration");
      } finally {
        setLoading(false);
      }
    };

    fetchSysConfig();
  }, []);

  return (
    <AppContainer>
      <AppHeader>
        <div className="flex items-center justify-between w-full">
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        </div>
      </AppHeader>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-8 px-4">
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && sysConfig && (
            <Tabs
              defaultValue="system"
              className="w-full"
              orientation="vertical"
            >
              <div className="flex gap-6 items-start w-full">
                <TabsList className="flex flex-col h-fit w-48 gap-2 flex-shrink-0">
                  <TabsTrigger
                    value="system"
                    className="flex items-center gap-2 w-full justify-start"
                  >
                    <Terminal className="h-4 w-4" />
                    System
                  </TabsTrigger>
                  <TabsTrigger
                    value="proxies"
                    className="flex items-center gap-2 w-full justify-start"
                  >
                    <Network className="h-4 w-4" />
                    Proxies
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 w-full min-w-0">
                  <TabsContent value="system" className="mt-0 space-y-6 w-full">
                    <div className="space-y-2 w-full">
                      <Label htmlFor="log-level">Log Level</Label>
                      <Input
                        id="log-level"
                        value={sysConfig.log_level}
                        readOnly
                        className="bg-muted"
                      />
                    </div>

                    <div className="space-y-2 w-full">
                      <Label
                        htmlFor="db-path"
                        className="flex items-center gap-2"
                      >
                        <Database className="h-4 w-4" />
                        Database Path
                      </Label>
                      <Input
                        id="db-path"
                        value={sysConfig.db_path}
                        readOnly
                        className="bg-muted font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2 w-full">
                      <Label
                        htmlFor="api-addr"
                        className="flex items-center gap-2"
                      >
                        <Server className="h-4 w-4" />
                        API Address
                      </Label>
                      <Input
                        id="api-addr"
                        value={sysConfig.api_addr}
                        readOnly
                        className="bg-muted font-mono text-sm"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="proxies" className="mt-0 w-full">
                    {sysConfig.proxies && sysConfig.proxies.length > 0 ? (
                      <div className="rounded-md border bg-muted/50 overflow-hidden">
                        <JsonEditor
                          initialJson={sysConfig.proxies}
                          rootFontSize="14px"
                          viewOnly={true}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No proxy configurations found
                      </p>
                    )}
                  </TabsContent>
                </div>
              </div>
            </Tabs>
          )}

          {/* Copyright Section */}
          <div className="pt-8">
            <Separator className="mb-6" />
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Inspect HTTP Proxy
              </p>
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} All rights reserved.
              </p>
              <p className="text-xs text-muted-foreground">
                Made with ❤️ for developers
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppContainer>
  );
}

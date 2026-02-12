"use client";

import {
  AlertCircle,
  Database,
  FileText,
  Network,
  Save,
  ScrollText,
  Server,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  max_sessions_retain: number;
  db_size: number;
  config_file?: string;
  proxies: ProxyEntry[];
}

const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "panic",
];

const defaultDbPath = "~/.proxy/proxy_logs.db";
const defaultConfigPath = ".proxy.config.toml";

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function SettingsPage() {
  const [sysConfig, setSysConfig] = useState<SysConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logLevel, setLogLevel] = useState<string>("");
  const [apiAddr, setApiAddr] = useState<string>("");
  const [maxSessionsRetain, setMaxSessionsRetain] = useState<string>("");

  useEffect(() => {
    const fetchSysConfig = async () => {
      try {
        const response = await api.get("/api/sysconfig");
        setSysConfig(response.data);
        setLogLevel(response.data.log_level);
        setApiAddr(response.data.api_addr);
        setMaxSessionsRetain(
          (response.data.max_sessions_retain ?? 10000).toString(),
        );
      } catch (err) {
        console.error("Failed to fetch system config:", err);
        setError("Failed to load system configuration");
      } finally {
        setLoading(false);
      }
    };

    fetchSysConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/api/sysconfig", {
        log_level: logLevel,
        api_addr: apiAddr,
        max_sessions_retain: maxSessionsRetain,
      });
      toast.success("Settings saved successfully", {
        description: "Changes will take effect after the next restart.",
      });
    } catch (err) {
      console.error("Failed to save system config:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const isChanged =
    sysConfig &&
    (logLevel !== sysConfig.log_level ||
      apiAddr !== sysConfig.api_addr ||
      maxSessionsRetain !==
        (sysConfig.max_sessions_retain ?? 10000).toString());

  return (
    <AppContainer>
      <AppHeader>
        <div className="flex items-center justify-between w-full">
          					<h1 className="text-xl font-bold tracking-tight text-primary">System Settings</h1>
          
          {!loading && !error && (
            <Button
              onClick={handleSave}
              disabled={saving || !isChanged}
              size="sm"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          )}
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
                    <div className="space-y-4">
                      <div className="space-y-2 w-full">
                        <Label
                          htmlFor="db-path"
                          className="flex items-center gap-2"
                        >
                          <Database className="h-4 w-4" />
                          Database Path
                        </Label>
                        <div className="flex gap-4 items-center">
                          <Input
                            id="db-path"
                            value={
                              sysConfig.db_path
                                ? sysConfig.db_path
                                : defaultDbPath
                            }
                            readOnly
                            className="flex-1 bg-muted font-mono text-sm"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          Calculated path. Change via{" "}
                          <code className="bg-muted px-1 rounded">
                            --db-path
                          </code>{" "}
                          command line flag.
                        </p>
                      </div>

                      <div className="space-y-2 w-full">
                        <Label
                          htmlFor="config-file"
                          className="flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Config File
                        </Label>
                        <Input
                          id="config-file"
                          value={sysConfig.config_file || defaultConfigPath}
                          readOnly
                          className="bg-muted font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground italic">
                          Calculated path. Change via{" "}
                          <code className="bg-muted px-1 rounded">
                            --config
                          </code>{" "}
                          command line flag.
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2 w-full">
                      <Label htmlFor="log-level">
                        <ScrollText className="h-4 w-4" /> Log Level
                      </Label>
                      <Select value={logLevel} onValueChange={setLogLevel}>
                        <SelectTrigger
                          id="log-level"
                          className="w-full bg-input/30"
                        >
                          <SelectValue placeholder="Select log level" />
                        </SelectTrigger>
                        <SelectContent>
                          {LOG_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Controls the verbosity of the server logs.
                      </p>
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
                        value={apiAddr}
                        onChange={(e) => setApiAddr(e.target.value)}
                        className="bg-input/30 font-mono text-sm"
                        placeholder=":8080"
                      />
                      <p className="text-xs text-muted-foreground">
                        The address and port the UI and API will listen on.
                      </p>
                    </div>

                    <div className="space-y-2 w-full">
                      <Label
                        htmlFor="max-sessions"
                        className="flex items-center gap-2"
                      >
                        <Database className="h-4 w-4" />
                        Max Sessions to Retain
                      </Label>
                      <Input
                        id="max-sessions"
                        type="number"
                        value={maxSessionsRetain}
                        onChange={(e) => setMaxSessionsRetain(e.target.value)}
                        className="bg-input/30 font-mono text-sm"
                        placeholder="10000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Automatically delete oldest sessions when this limit is
                        reached. Bookmarked sessions are never deleted.
                      </p>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        The current DB at{" "}
                        <strong>{sysConfig.db_path || defaultDbPath}</strong> is
                        about{" "}
                        <strong>{formatBytes(sysConfig.db_size ?? 0)}</strong>.
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="proxies" className="mt-0 w-full">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-medium">
                          Proxy Configurations
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          These are the proxy in{" "}
                          {sysConfig.config_file || defaultConfigPath}. To
                          modify it, please edit the file.
                        </p>
                      </div>
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
                    </div>
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

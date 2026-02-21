import { Check, ChevronDown, Search as SearchIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProxyConfig } from "@/types";

interface ConfigSelectorProps {
  configs: ProxyConfig[];
  selectedConfigId: string | null;
  onConfigChange: (id: string) => void;
}

export function formatConfigDisplayName(config: ProxyConfig) {
  let parsedJson: any;
  if (typeof config.config_row.ConfigJSON === "string") {
    try {
      parsedJson = JSON.parse(config.config_row.ConfigJSON);
    } catch (e) {
      parsedJson = {};
    }
  } else {
    parsedJson = config.config_row.ConfigJSON;
  }
  const listen = parsedJson?.listen || parsedJson?.Listen || "unknown";
  const target = parsedJson?.target || parsedJson?.Target || "unknown";

  const source =
    config.config_row.SourcePath !== "shell"
      ? config.config_row.SourcePath.split("/").pop()
      : config.config_row.Cwd.split("/").pop();

  return `${listen} 🠞 ${target} (${source})`;
}

export function ConfigSelector({
  configs,
  selectedConfigId,
  onConfigChange,
}: ConfigSelectorProps) {
  const [filterQuery, setFilterQuery] = React.useState("");

  if (!Array.isArray(configs) || configs.length === 0) {
    return null;
  }

  const selectedConfig = configs.find(
    (c) => c.config_row.ID === selectedConfigId,
  );

  const filteredConfigs = React.useMemo(() => {
    if (!filterQuery) return configs;
    const q = filterQuery.toLowerCase();
    return configs.filter((c) => {
      const displayName = formatConfigDisplayName(c).toLowerCase();
      const sourcePath = c.config_row.SourcePath.toLowerCase();
      const cwd = c.config_row.Cwd.toLowerCase();
      return (
        displayName.includes(q) || sourcePath.includes(q) || cwd.includes(q)
      );
    });
  }, [configs, filterQuery]);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setFilterQuery("")}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 relative">
          <span className="font-medium truncate max-w-[300px]">
            {selectedConfig ? formatConfigDisplayName(selectedConfig) : ""}
          </span>
          {selectedConfig?.is_proxyserver_active && (
            <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          )}
          <ChevronDown className="h-4 w-4 opacity-50 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[450px] w-full">
        <div className="p-2 border-b">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Filter configs..."
              className="pl-7 h-8 text-xs"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()} // Prevent closing dropdown on space
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filteredConfigs.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No matching configs.
            </div>
          ) : (
            filteredConfigs.map((config) => (
              <DropdownMenuItem
                key={config.config_row.ID}
                onClick={() => onConfigChange(config.config_row.ID)}
                className="cursor-pointer flex flex-col items-start py-2 gap-1"
              >
                <div className="flex items-center w-full">
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      selectedConfigId === config.config_row.ID
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="flex-1 font-medium truncate">
                    {formatConfigDisplayName(config)}
                  </span>
                  {config.is_proxyserver_active && (
                    <span className="ml-2 flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  )}
                </div>
                <div className="pl-6 flex flex-col gap-0.5 text-[10px] text-muted-foreground w-full">
                  <div className="truncate">
                    <span className="font-semibold opacity-70 uppercase mr-1">
                      Source:
                    </span>
                    {config.config_row.SourcePath}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold opacity-70 uppercase mr-1">
                      WorkDir:
                    </span>
                    {config.config_row.Cwd}
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

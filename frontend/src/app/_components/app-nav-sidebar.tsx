"use client";

import { useAtom } from "jotai";
import {
  ChevronLeft,
  ChevronRight,
  List,
  PanelBottom,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Fontdiner_Swanky } from "next/font/google";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { ReadyState } from "react-use-websocket";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isPanelOpenAtom } from "../_jotai/bottom-panel-store";
import { pinnedConfigsPersistenceAtom } from "../_jotai/pinned-configs-store";
import { formatConfigDisplayName } from "../history/_components/config-selector";
import { navItems, navTitle } from "../nav-items";
import { useGlobal } from "./global-app-context";
import { useWebSocketContext } from "./websocket-provider";

const fontdinerSwanky = Fontdiner_Swanky({
  weight: "400",
  subsets: ["latin"],
});

export function AppNavSidebar() {
  const [navExpanded, setNavExpanded] = React.useState(true);
  const [isPanelOpen, setIsPanelOpen] = useAtom(isPanelOpenAtom);
  const [pinnedConfigs, setPinnedConfigs] = useAtom(
    pinnedConfigsPersistenceAtom,
  );
  const { allConfigs } = useGlobal();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { readyState } = useWebSocketContext();

  // Derive active menu directly from URL — no useState/useEffect needed
  const activeMenu = React.useMemo(() => {
    if (pathname.startsWith("/recent")) {
      const configIdFromUrl = searchParams.get("config_id");
      if (configIdFromUrl) return `recent-${configIdFromUrl}`;
      return "recent";
    }
    const activeItem = navItems.find((item) => pathname.startsWith(item.path));
    return activeItem ? activeItem.id : "";
  }, [pathname, searchParams]);

  const topMenuItems = navItems.filter((item) => item.position !== "bottom");
  const bottomMenuItems = navItems.filter((item) => item.position === "bottom");

  const handleMenuClick = (_itemId: string, path: string) => {
    router.push(path);
  };

  const handleRemovePinned = (e: React.MouseEvent, configId: string) => {
    e.stopPropagation();
    setPinnedConfigs(pinnedConfigs.filter((p) => p.id !== configId));
  };

  const pinnedItems = React.useMemo(() => {
    return pinnedConfigs
      .map((p) => {
        const config = allConfigs.find((c) => c.config_row.ID === p.id);
        if (!config) return null;

        const sp = new URLSearchParams(p.params);
        return {
          id: `recent-${p.id}`,
          label: formatConfigDisplayName(config),
          path: `/recent?${sp.toString()}`,
          configId: p.id,
        };
      })
      .filter(Boolean) as {
      id: string;
      label: string;
      path: string;
      configId: string;
    }[];
  }, [pinnedConfigs, allConfigs]);

  const connectionStatusMap: Record<ReadyState, string> = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Connected | Live updates ON",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed | Live updates OFF",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  };

  const isConnected = readyState === ReadyState.OPEN;
  const StatusIcon = isConnected ? Wifi : WifiOff;

  const statusButton = (
    <div
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-default",
        isConnected ? "text-green-500" : "text-yellow-500",
        !navExpanded && "justify-center",
      )}
    >
      <StatusIcon className="h-5 w-5 flex-shrink-0" />
      {navExpanded && (
        <span className="text-sm font-medium">
          {connectionStatusMap[readyState]}
        </span>
      )}
    </div>
  );

  const panelButton = (
    <button
      type="button"
      onClick={() => setIsPanelOpen(!isPanelOpen)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
        isPanelOpen
          ? "bg-transparent text-primary"
          : "hover:bg-muted text-muted-foreground hover:text-foreground",
        !navExpanded && "justify-center",
      )}
    >
      <PanelBottom
        className={cn("h-5 w-5 flex-shrink-0", isPanelOpen && "text-primary")}
      />
      {navExpanded && (
        <span className="text-sm font-medium">
          {isPanelOpen ? "Close Bottom Panels" : "Open Bottom Panels"}
        </span>
      )}
    </button>
  );

  return (
    <div
      className={cn(
        "border-r bg-muted/20 flex flex-col transition-all duration-300",
        navExpanded ? "w-64" : "w-16",
      )}
    >
      {/* Nav Header */}
      <div className="h-[60px] border-b px-4 flex items-center justify-between">
        {navExpanded && (
          <div className="flex items-center gap-2">
            <Image
              src="/ihpp-32x32.png"
              alt="Logo"
              width="32"
              height="32"
              className="h-5 w-5"
            />
            <span
              className={cn(
                "text-lg text-primary mt-[6px]",
                fontdinerSwanky.className,
              )}
            >
              {navTitle}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setNavExpanded(!navExpanded)}
        >
          {navExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <Image
              src="/ihpp-32x32.png"
              alt="Logo"
              width="32"
              height="32"
              className="h-5 w-5"
            />
            // <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Menu Items */}
      <div className="p-2 flex-1 space-y-1">
        <nav className="py-2 overflow-y-auto border-b">
          {topMenuItems.map((item) => {
            const Icon = item.icon;
            const button = (
              <button
                type="button"
                key={item.id}
                onClick={() => handleMenuClick(item.id, item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-1",
                  activeMenu === item.id
                    ? "bg-primary/10 text-primary font-bold"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground",
                  !navExpanded && "justify-center",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    activeMenu === item.id && "text-primary",
                  )}
                />
                {navExpanded && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            );
            return navExpanded ? (
              button
            ) : (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Pinned Recent Traffic Items */}
        {pinnedItems.length > 0 && (
          <div className="mt-4 space-y-1">
            {navExpanded && (
              <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Pinned Recent Traffics
              </p>
            )}
            {pinnedItems.map((item) => {
              const button = (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleMenuClick(item.id, item.path)}
                  className={cn(
                    "w-full group relative flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                    activeMenu === item.id
                      ? "bg-primary/10 text-primary font-bold"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground",
                    !navExpanded && "justify-center",
                  )}
                >
                  <List
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      activeMenu === item.id && "text-primary",
                    )}
                  />
                  {navExpanded && (
                    <>
                      <span className="text-sm font-medium truncate pr-6">
                        {item.label}
                      </span>
                      <div
                        onClick={(e) => handleRemovePinned(e, item.configId)}
                        className="absolute right-2 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </div>
                    </>
                  )}
                </button>
              );
              return navExpanded ? (
                button
              ) : (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-2 border-t space-y-1">
        {bottomMenuItems.map((item) => {
          const Icon = item.icon;
          const button = (
            <button
              type="button"
              key={item.id}
              onClick={() => handleMenuClick(item.id, item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-1",
                activeMenu === item.id
                  ? "bg-primary/10 text-primary font-bold"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
                !navExpanded && "justify-center",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  activeMenu === item.id && "text-primary",
                )}
              />
              {navExpanded && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          );
          return navExpanded ? (
            button
          ) : (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}

        {/* Connection Status */}
        {navExpanded ? (
          statusButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{statusButton}</TooltipTrigger>
            <TooltipContent side="right">
              {connectionStatusMap[readyState]}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Panel Toggle */}
        {navExpanded ? (
          panelButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{panelButton}</TooltipTrigger>
            <TooltipContent side="right">
              {isPanelOpen ? "Close Bottom Panels" : "Open Bottom Panels"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

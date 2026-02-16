"use client";

import { useAtom } from "jotai";
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  PanelBottom,
  Wifi,
  WifiOff,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
import { navItems, navTitle } from "../nav-items";
import { useWebSocketContext } from "./websocket-provider";

export function AppNavSidebar() {
  const [navExpanded, setNavExpanded] = React.useState(false);
  const [isPanelOpen, setIsPanelOpen] = useAtom(isPanelOpenAtom);
  const router = useRouter();
  const pathname = usePathname();
  const { readyState } = useWebSocketContext();

  // Determine active menu based on current pathname
  const getActiveMenuFromPath = React.useCallback(() => {
    const activeItem = navItems.find((item) => pathname.startsWith(item.path));
    return activeItem ? activeItem.id : "";
  }, [pathname]);

  const [activeMenu, setActiveMenu] = React.useState(getActiveMenuFromPath());

  const menuItems = navItems;

  // Update active menu when pathname changes
  React.useEffect(() => {
    setActiveMenu(getActiveMenuFromPath());
  }, [getActiveMenuFromPath]);

  const handleMenuClick = (itemId: string) => {
    const item = menuItems.find((m) => m.id === itemId);
    if (item) {
      setActiveMenu(itemId);
      router.push(item.path);
    }
  };

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
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted text-muted-foreground hover:text-foreground",
        !navExpanded && "justify-center",
      )}
    >
      <PanelBottom className="h-5 w-5 flex-shrink-0" />
      {navExpanded && (
        <span className="text-sm font-medium">
          {isPanelOpen ? "Close Panel" : "Open Panel"}
        </span>
      )}
    </button>
  );

  return (
    <div
      className={cn(
        "border-r bg-muted/20 flex flex-col transition-all duration-300",
        navExpanded ? "w-56" : "w-16",
      )}
    >
      {/* Nav Header */}
      <div className="h-[60px] border-b px-4 flex items-center justify-between">
        {navExpanded && (
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">{navTitle}</span>
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
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const button = (
            <button
              type="button"
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-1",
                activeMenu === item.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
                !navExpanded && "justify-center",
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
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

      {/* Footer Actions */}
      <div className="p-2 border-t space-y-1">
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
              {isPanelOpen ? "Close Panel" : "Open Panel"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

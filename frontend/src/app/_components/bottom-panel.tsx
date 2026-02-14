/** biome-ignore-all lint/a11y/noStaticElementInteractions: use as button */
"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  activeTabIdAtom,
  isPanelOpenAtom,
  removeTabAtom,
  tabsAtom,
} from "../_jotai/bottom-panel-store";

interface BottomPanelProps {
  defaultHeight?: number;
  minHeight?: number;
  maxHeightVh?: number;
  onAddTab?: () => void;
  showAddButton?: boolean;
  tabContent?: Record<string, React.ReactNode>;
}

export function BottomPanel({
  defaultHeight = 300,
  minHeight = 150,
  maxHeightVh = 50,
  onAddTab,
  showAddButton = false,
  tabContent = {},
}: BottomPanelProps) {
  const [isOpen, setIsOpen] = useAtom(isPanelOpenAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);
  const tabs = useAtomValue(tabsAtom);
  const removeTab = useSetAtom(removeTabAtom);

  const [panelHeight, setPanelHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);

  // Update active tab when tabs change
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    } else if (tabs.length === 0) {
      setActiveTabId(null);
    }
  }, [tabs, activeTabId, setActiveTabId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const viewportHeight = window.innerHeight;
      const maxHeight = (viewportHeight * maxHeightVh) / 100;
      const newHeight = viewportHeight - e.clientY;

      setPanelHeight(Math.max(minHeight, Math.min(newHeight, maxHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minHeight, maxHeightVh]);

  // Check for overflow to show/hide scroll buttons
  // biome-ignore lint/correctness/useExhaustiveDependencies: necessary
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container || !isOpen) return;

    const checkOverflow = () => {
      setShowScrollButtons(container.scrollWidth > container.clientWidth);
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(container);

    return () => observer.disconnect();
  }, [tabs, isOpen]);

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabId && tabsContainerRef.current) {
      const activeElement = tabsContainerRef.current.querySelector(
        `[data-tab-id="${activeTabId}"]`,
      );
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeTabId]);

  const handleCloseTab = (tabId: string) => {
    removeTab(tabId);
  };

  const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < tabs.length - 1 && currentIndex !== -1;

  const goToNextTab = () => {
    if (canGoNext) {
      setActiveTabId(tabs[currentIndex + 1].id);
    }
  };

  const goToPrevTab = () => {
    if (canGoPrev) {
      setActiveTabId(tabs[currentIndex - 1].id);
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="border-t bg-background flex flex-col"
      style={{ height: `${panelHeight}px` }}
    >
      {/* Resize Handle */}
      <div
        className="h-1 bg-border hover:bg-primary cursor-ns-resize transition-colors flex-shrink-0"
        onMouseDown={() => setIsResizing(true)}
      />

      {/* Tab Bar */}
      <div className="flex items-center border-b bg-muted/20 flex-shrink-0">
        {showScrollButtons && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-8 flex-shrink-0 rounded-none border-r"
            disabled={!canGoPrev}
            onClick={goToPrevTab}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div
          ref={tabsContainerRef}
          className="flex-1 flex items-center overflow-x-auto no-scrollbar"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium border-r transition-colors whitespace-nowrap group h-9",
                  activeTabId === tab.id
                    ? "bg-background text-foreground"
                    : "bg-muted/100 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {tab.autoCollapseTabTrigger ? (
                  activeTabId === tab.id ? (
                    <span title={tab.label}>{tab.label}</span>
                  ) : (
                    ""
                  )
                ) : (
                  <span title={tab.label}>{tab.label}</span>
                )}
                {tab.closeable !== false && (
                  <a
                    // biome-ignore lint/a11y/useValidAnchor: a is used as button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </a>
                )}
              </button>
            );
          })}
          {showAddButton && onAddTab && (
            <button
              type="button"
              onClick={onAddTab}
              className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors h-9"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        {showScrollButtons && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-8 flex-shrink-0 rounded-none border-l"
            disabled={!canGoNext}
            onClick={goToNextTab}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="flex-shrink-0 mx-2"
        >
          <ArrowDownToLine className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab ? (
          <div className="p-0 flex flex-col h-full">
            {tabContent[activeTab.id] || activeTab.content || (
              <div className="text-muted-foreground">
                No content for {activeTab.label}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            No tabs open. {showAddButton && "Click + to add a tab."}
          </div>
        )}
      </div>
    </div>
  );
}

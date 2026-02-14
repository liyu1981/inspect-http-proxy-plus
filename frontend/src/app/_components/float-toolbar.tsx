"use client";

import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FloatToolbarProps {
  children: React.ReactNode;
  top?: string;
  className?: string;
}

export function FloatToolbar({
  children,
  top = "top-8",
  className,
}: FloatToolbarProps) {
  return (
    <div
      className={cn(
        "absolute right-0 z-50 transition-all duration-300 ease-in-out group",
        "translate-x-[1.5rem] hover:translate-x-0",
        "opacity-80 hover:opacity-100",
        top,
        className,
      )}
    >
      {/* Content */}
      <div className="bg-primary/30 backdrop-blur-sm shadow-md border border-primary/50 border-r-0 rounded-l-md p-1 flex flex-col gap-1.5 min-w-[44px]">
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
      </div>
    </div>
  );
}

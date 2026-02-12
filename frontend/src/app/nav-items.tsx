import { Bookmark, Brackets, List, Settings, Timer } from "lucide-react";

export const navTitle = "HTTP Inspector";

export const defaultNavItem = "recent";

export const navItems = [
  {
    id: "recent" as const,
    icon: List,
    label: "Recent Traffic",
    path: "/recent",
  },
  {
    id: "history" as const,
    icon: Timer,
    label: "History Traffic",
    path: "/history",
  },
  {
    id: "saved" as const,
    icon: Bookmark,
    label: "Saved",
    path: "/saved",
  },
  {
    id: "proxies" as const,
    icon: Brackets,
    label: "Proxy Servers",
    path: "/proxies",
    position: "bottom",
  },
  {
    id: "settings" as const,
    icon: Settings,
    label: "System Settings",
    path: "/settings",
    position: "bottom",
  },
];

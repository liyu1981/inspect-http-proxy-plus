import { Brackets, List, Settings } from "lucide-react";

export const navTitle = "HTTP Inspector";

export const defaultNavItem = "inspect";

export const navItems = [
  {
    id: "inspect" as const,
    icon: List,
    label: "Inspect Traffic",
    path: "/inspect",
  },
  {
    id: "proxies" as const,
    icon: Brackets,
    label: "Proxy Servers",
    path: "/proxies",
  },
  {
    id: "settings" as const,
    icon: Settings,
    label: "Settings",
    path: "/settings",
  },
];

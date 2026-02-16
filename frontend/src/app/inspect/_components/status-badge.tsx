import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ code }: { code: number }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let className = "";

  if (code === 0) {
    variant = "outline";
    return (
      <Badge variant={variant} className="animate-pulse">
        Pending
      </Badge>
    );
  }

  if (code >= 200 && code < 300) {
    variant = "secondary";
    className =
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100";
  } else if (code >= 300 && code < 400) {
    variant = "secondary";
    className =
      "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-100";
  } else if (code >= 400) {
    variant = "destructive";
  }

  return (
    <Badge variant={variant} className={cn("font-mono", className)}>
      {code}
    </Badge>
  );
}

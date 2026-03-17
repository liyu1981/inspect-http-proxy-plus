import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface HeadersSectionProps {
  title: string;
  data: Record<string, string[]> | undefined;
}

export function HeadersSection({ title, data }: HeadersSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        {title}{" "}
        <Badge variant="secondary" className="text-[10px] h-5">
          {Object.keys(data).length}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 hover:bg-transparent"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </h3>
      {isExpanded && (
        <div className="rounded-md border bg-muted/30 overflow-x-auto">
          <Table className="table-fixed w-full min-w-full">
            <TableBody>
              {Object.entries(data).map(([key, values]) => (
                <TableRow key={key}>
                  <TableCell className="w-[200px] min-w-[200px] font-medium text-xs font-mono text-muted-foreground align-top">
                    {key}
                  </TableCell>
                  <TableCell
                    className="font-mono text-xs whitespace-normal break-words"
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {values.join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface HeadersSectionProps {
  title: string;
  data: Record<string, string[]>;
}

export function HeadersSection({ title, data }: HeadersSectionProps) {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        {title}{" "}
        <Badge variant="secondary" className="text-[10px] h-5">
          {Object.keys(data).length}
        </Badge>
      </h3>
      <div className="rounded-md border bg-muted/30">
        <Table>
          <TableBody>
            {Object.entries(data).map(([key, values]) => (
              <TableRow key={key}>
                <TableCell className="w-[200px] font-medium text-xs font-mono text-muted-foreground">
                  {key}
                </TableCell>
                <TableCell className="font-mono text-xs break-all">
                  {values.join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { FileText } from "lucide-react";

export function EmptySessionState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
      <FileText className="h-12 w-12 mb-4 opacity-20" />
      <p>Select a session to view details</p>
    </div>
  );
}

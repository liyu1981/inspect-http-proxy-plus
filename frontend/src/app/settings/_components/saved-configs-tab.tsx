"use client";

import { format } from "date-fns";
import { Database, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProxyConfig } from "@/types";
import { useGlobal } from "../../_components/global-app-context";

export function SavedConfigsTab() {
  const { allConfigs, isLoading, refreshConfigs } = useGlobal();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await api.delete(`/api/configs/${id}`);
      toast.success("Configuration and its sessions deleted successfully");
      refreshConfigs();
    } catch (err: any) {
      console.error("Delete failed:", err);
      toast.error(
        err.response?.data?.error || "Failed to delete configuration",
      );
    } finally {
      setIsDeleting(null);
    }
  };

  const formatConfigName = (config: ProxyConfig) => {
    try {
      const configJSON = config.config_row.ConfigJSON;
      const parsed =
        typeof configJSON === "string" ? JSON.parse(configJSON) : configJSON;
      const listen = parsed.listen || parsed.Listen || "??";
      const target = parsed.target || parsed.Target || "??";
      return `${listen} 🠞 ${target}`;
    } catch {
      return "Invalid Config";
    }
  };

  if (isLoading && allConfigs.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Database-Saved Configurations</h3>
        <p className="text-xs text-muted-foreground">
          Every time you run the proxy with a unique set of parameters, a new
          configuration record is created in the database. Deleting a record
          will also remove all its associated traffic sessions.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Configuration (Listen 🠞 Target)</TableHead>
              <TableHead>Config ID</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allConfigs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No configurations found in database.
                </TableCell>
              </TableRow>
            ) : (
              allConfigs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-primary/90">
                        {formatConfigName(config)}
                      </span>
                      <span
                        className="text-[10px] text-muted-foreground truncate max-w-[300px]"
                        title={config.config_row.SourcePath}
                      >
                        {config.config_row.SourcePath}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[100px] truncate">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/history?config_id=${config.id}`}
                          className="hover:underline text-blue-500"
                        >
                          {config.id.length > 10
                            ? `${config.id.slice(0, 5)}...${config.id.slice(-5)}`
                            : config.id}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{config.id}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Database className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">
                        {config.session_count || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(config.created_at), "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    {config.is_proxyserver_active ? (
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-600 border-green-200 text-[10px] h-5"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 opacity-60"
                      >
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={
                            config.is_proxyserver_active ||
                            isDeleting === config.id
                          }
                        >
                          {isDeleting === config.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete Configuration?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the configuration{" "}
                            <strong>{formatConfigName(config)}</strong> and all
                            of its <strong>{config.session_count || 0}</strong>{" "}
                            associated traffic sessions from the database. This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(config.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Everything
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

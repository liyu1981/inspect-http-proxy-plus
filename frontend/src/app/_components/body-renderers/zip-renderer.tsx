"use client";

import JSZip from "jszip";
import { ArchiveIcon, FileIcon, FolderIcon, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { BodyRenderer, BodyRendererProps } from "./types";

interface ZipFile {
  name: string;
  size: number;
  isDir: boolean;
}

const ZipRenderer: React.FC<BodyRendererProps> = ({ body, contentType }) => {
  const [files, setFiles] = useState<ZipFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadZip = async () => {
      setLoading(true);
      setError(null);
      try {
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(body.trim());
        const data = isBase64 ? body : btoa(body);
        const zip = await JSZip.loadAsync(data, { base64: true });

        const zipFiles: ZipFile[] = [];
        zip.forEach((relativePath, file) => {
          zipFiles.push({
            name: relativePath,
            size: (file as any)._data?.uncompressedSize || 0,
            isDir: file.dir,
          });
        });

        // Sort: directories first, then alphabetical
        zipFiles.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });

        setFiles(zipFiles);
      } catch (err) {
        console.error("Failed to parse zip file:", err);
        setError(
          "Failed to parse zip archive. It may be corrupted or encrypted.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadZip();
  }, [body]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[150px] w-full bg-muted/30">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
        <span className="text-xs text-muted-foreground italic">
          Parsing zip archive...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[150px] w-full bg-muted/30">
        <ArchiveIcon className="h-10 w-10 text-destructive/50 mb-2" />
        <span className="text-sm font-semibold text-destructive">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-[200px] bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-4 px-2">
        <ArchiveIcon className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-sm">Zip Archive Contents</h4>
        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
          {files.length} items
        </span>
      </div>

      <div className="flex-1 bg-card rounded-md border shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] bg-muted/50 border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2">
          <div>Name</div>
          <div className="text-right">Size</div>
        </div>

        <div className="max-h-[300px] overflow-auto divide-y divide-muted/50">
          {files.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground italic">
              Archive is empty
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.name}
                className="grid grid-cols-[1fr_auto] items-center px-4 py-2 hover:bg-muted/30 transition-colors text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  {file.isDir ? (
                    <FolderIcon className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  ) : (
                    <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-mono truncate" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <div className="text-right text-muted-foreground font-mono ml-4">
                  {file.isDir ? "--" : formatSize(file.size)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-[10px] text-muted-foreground italic">
          Content Type: {contentType}
        </p>
      </div>
    </div>
  );
};

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const zipRenderer: BodyRenderer = {
  id: "zip",
  label: "Zip",
  priority: 10,
  match: (contentType: string) =>
    contentType.includes("zip") ||
    contentType.includes("application/x-zip-compressed"),
  component: ZipRenderer as any,
};

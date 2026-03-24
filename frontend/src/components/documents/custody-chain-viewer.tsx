"use client";

import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCustodyChain } from "@/hooks/use-documents";

interface CustodyChainViewerProps {
  documentId: string;
}

export function CustodyChainViewer({ documentId }: CustodyChainViewerProps) {
  const { data, isLoading } = useCustodyChain(documentId, true);

  if (isLoading) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Loading custody chain...
      </p>
    );
  }

  if (!data) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No custody data available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{data.file_name}</span>
        <Badge variant={data.vault_status === "sealed" ? "destructive" : "secondary"}>
          {data.vault_status}
        </Badge>
      </div>

      {data.entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No custody entries recorded.
        </p>
      ) : (
        <div className="relative space-y-0 border-l-2 border-muted pl-6">
          {data.entries.map((entry, index) => (
            <div key={index} className="relative pb-4">
              <div className="absolute -left-[31px] top-1 size-3 rounded-full border-2 border-background bg-muted-foreground" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {entry.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                {entry.details && (
                  <p className="text-sm text-muted-foreground">{entry.details}</p>
                )}
                <p className="font-mono text-xs text-muted-foreground">
                  User: {entry.user_id.slice(0, 8)}…
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

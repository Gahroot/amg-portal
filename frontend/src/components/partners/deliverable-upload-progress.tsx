"use client";

import { Progress } from "@/components/ui/progress";

interface DeliverableUploadProgressProps {
  progress: number;
}

export function DeliverableUploadProgress({ progress }: DeliverableUploadProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Uploading files…</span>
        <span className="font-medium">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

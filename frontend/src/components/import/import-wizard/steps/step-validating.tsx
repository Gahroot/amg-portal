"use client";

import { Loader2 } from "lucide-react";

export function StepValidating() {
  return (
    <div className="flex flex-col items-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-lg font-medium">Validating your data...</p>
      <p className="text-sm text-muted-foreground">This may take a moment</p>
    </div>
  );
}

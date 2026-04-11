import { AlertCircle } from "lucide-react";

interface CellErrorProps {
  message: string;
}

/**
 * Shared inline error tooltip displayed beneath an editable cell.
 */
export function CellError({ message }: CellErrorProps) {
  return (
    <div className="absolute -bottom-6 left-0 z-10 flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-sm">
      <AlertCircle className="h-3 w-3" />
      {message}
    </div>
  );
}

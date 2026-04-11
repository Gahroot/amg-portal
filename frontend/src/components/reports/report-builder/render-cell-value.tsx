import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function renderCellValue(value: unknown, type: string): ReactNode {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;

  const str = String(value);

  if (type === "rag") {
    const color =
      str === "green"
        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
        : str === "amber"
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
          : str === "red"
            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
            : "bg-muted text-muted-foreground";
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", color)}>
        {str}
      </span>
    );
  }

  if (type === "status") {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize">
        {str.replace(/_/g, " ")}
      </span>
    );
  }

  if (type === "date" && str.includes("T")) {
    return str.slice(0, 10);
  }

  if (type === "number") {
    const num = Number(value);
    return isNaN(num) ? str : num.toLocaleString();
  }

  return str;
}

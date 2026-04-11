import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FieldMeta } from "@/types/custom-report";
import { FIELD_TYPE_COLORS } from "./constants";

interface AvailableFieldsPanelProps {
  availableFields: FieldMeta[] | undefined;
  selectedKeys: Set<string>;
  onAdd: (meta: FieldMeta) => void;
}

export function AvailableFieldsPanel({
  availableFields,
  selectedKeys,
  onAdd,
}: AvailableFieldsPanelProps) {
  return (
    <Card className="flex-1 overflow-hidden">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Available fields</CardTitle>
        <CardDescription className="text-xs">Click or drag to add</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-64">
          <div className="space-y-0.5 p-2">
            {availableFields?.map((meta) => (
              <button
                key={meta.key}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors",
                  selectedKeys.has(meta.key)
                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    : "hover:bg-accent cursor-pointer",
                )}
                onClick={() => !selectedKeys.has(meta.key) && onAdd(meta)}
                disabled={selectedKeys.has(meta.key)}
              >
                <span className="truncate">{meta.label}</span>
                <span
                  className={cn(
                    "ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    FIELD_TYPE_COLORS[meta.type],
                  )}
                >
                  {meta.type}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

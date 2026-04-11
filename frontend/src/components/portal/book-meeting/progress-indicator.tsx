import { cn } from "@/lib/utils";
import type { Step } from "./shared";

const STEP_LABELS: Record<Step, string> = {
  type: "Meeting type",
  slot: "Pick a time",
  agenda: "Add details",
  confirm: "Confirm",
};

const ORDER: Step[] = ["type", "slot", "agenda", "confirm"];

export function ProgressIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {ORDER.map((s, i) => (
        <span
          key={s}
          className={cn(
            "flex items-center gap-2",
            step === s && "text-foreground font-medium"
          )}
        >
          {i > 0 && <span>/</span>}
          <span
            className={cn(
              "capitalize",
              step === s && "text-foreground font-medium"
            )}
          >
            {STEP_LABELS[s]}
          </span>
        </span>
      ))}
    </div>
  );
}

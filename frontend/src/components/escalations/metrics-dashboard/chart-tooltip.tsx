"use client";

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  labelFormatter?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const displayLabel = label
    ? labelFormatter
      ? labelFormatter(label)
      : label
    : "";
  return (
    <div className="rounded-lg border border-t-2 border-t-primary bg-background shadow-md p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold mb-2">{displayLabel}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PartnerComparisonItem } from "@/types/partner";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  MinusIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(v: number | null, decimals = 1): string {
  return v === null ? "—" : v.toFixed(decimals);
}

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)}%`;
}

/** Return the index of the best (highest) numeric value among partners, or -1 if all null. */
function bestIdx(values: (number | null)[], lowerIsBetter = false): number {
  let best: number | null = null;
  let idx = -1;
  values.forEach((v, i) => {
    if (v === null) return;
    if (best === null) {
      best = v;
      idx = i;
    } else if (!lowerIsBetter && v > best) {
      best = v;
      idx = i;
    } else if (lowerIsBetter && v < best) {
      best = v;
      idx = i;
    }
  });
  return idx;
}

const AVAIL_LABELS: Record<string, string> = {
  available: "Available",
  busy: "Busy",
  unavailable: "Unavailable",
};

const AVAIL_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  available: "default",
  busy: "secondary",
  unavailable: "destructive",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface CellProps {
  children: React.ReactNode;
  highlight?: boolean;
  className?: string;
}

function Cell({ children, highlight, className = "" }: CellProps) {
  return (
    <td
      className={`px-4 py-3 text-sm align-top border-b border-border ${
        highlight ? "bg-green-50/60" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

interface MetricRowProps {
  label: string;
  values: (number | null)[];
  format?: (v: number | null) => string;
  lowerIsBetter?: boolean;
  suffix?: string;
  progressMax?: number;
  showProgress?: boolean;
}

function MetricRow({
  label,
  values,
  format = fmtNum,
  lowerIsBetter = false,
  showProgress = false,
  progressMax = 100,
}: MetricRowProps) {
  const bi = bestIdx(values, lowerIsBetter);

  return (
    <tr>
      <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
        {label}
      </td>
      {values.map((v, i) => (
        <Cell key={i} highlight={bi === i && bi !== -1}>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={bi === i && bi !== -1 ? "font-semibold text-green-700" : ""}>
                {format(v)}
              </span>
              {bi === i && bi !== -1 && (
                <TrophyIcon className="h-3 w-3 text-amber-500 shrink-0" />
              )}
            </div>
            {showProgress && v !== null && (
              <Progress
                value={(v / progressMax) * 100}
                className="h-1.5"
              />
            )}
          </div>
        </Cell>
      ))}
    </tr>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={99}
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border"
      >
        {label}
      </td>
    </tr>
  );
}

// ── Export helpers ─────────────────────────────────────────────────────────────

function downloadCsv(partners: PartnerComparisonItem[]) {
  const rows: string[][] = [];
  const header = ["Metric", ...partners.map((p) => p.firm_name)];
  rows.push(header);

  const add = (label: string, vals: (string | number | null)[]) => {
    rows.push([label, ...vals.map((v) => (v === null ? "" : String(v)))]);
  };

  add("Availability", partners.map((p) => p.availability_status));
  add("Status", partners.map((p) => p.status));
  add("Compliance Verified", partners.map((p) => (p.compliance_verified ? "Yes" : "No")));
  add("Composite Score (/100)", partners.map((p) => p.composite_score));
  add("Avg Overall Rating (/5)", partners.map((p) => p.avg_overall));
  add("Avg Quality (/5)", partners.map((p) => p.avg_quality));
  add("Avg Timeliness (/5)", partners.map((p) => p.avg_timeliness));
  add("Avg Communication (/5)", partners.map((p) => p.avg_communication));
  add("Total Ratings", partners.map((p) => p.total_ratings));
  add("SLA Compliance (%)", partners.map((p) => p.sla_compliance_rate));
  add("SLA Tracked", partners.map((p) => p.total_sla_tracked));
  add("SLA Breached", partners.map((p) => p.total_sla_breached));
  add("Total Assignments", partners.map((p) => p.total_assignments));
  add("Completed Assignments", partners.map((p) => p.completed_assignments));
  add("Active Assignments", partners.map((p) => p.active_assignments));
  add("Max Concurrent", partners.map((p) => p.max_concurrent_assignments));
  add("Capacity Utilisation (%)", partners.map((p) => p.capacity_utilisation));
  add("Remaining Capacity", partners.map((p) => p.remaining_capacity));
  add("90-day Trend", partners.map((p) => p.trend_direction));
  add("Capabilities", partners.map((p) => p.capabilities.join("; ")));
  add("Geographies", partners.map((p) => p.geographies.join("; ")));

  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `partner-comparison-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PartnerComparisonProps {
  partners: PartnerComparisonItem[];
  onRemove?: (partnerId: string) => void;
}

export function PartnerComparison({ partners, onRemove }: PartnerComparisonProps) {
  const router = useRouter();

  if (partners.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No partners selected for comparison.
        </CardContent>
      </Card>
    );
  }

  const compositeScores = partners.map((p) => p.composite_score);
  const bestCompositeIdx = bestIdx(compositeScores);
  const bestPartner = bestCompositeIdx >= 0 ? partners[bestCompositeIdx] : null;

  return (
    <div className="space-y-4">
      {/* Recommendation banner */}
      {bestPartner && (
        <Card className="border-green-200 bg-green-50/60">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrophyIcon className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium text-green-900">
                Recommended:{" "}
                <Link
                  href={`/partners/${bestPartner.partner_id}`}
                  className="underline hover:no-underline"
                >
                  {bestPartner.firm_name}
                </Link>{" "}
                leads with a composite score of{" "}
                <span className="font-semibold">
                  {fmtNum(bestPartner.composite_score)}/100
                </span>
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/partners/${bestPartner.partner_id}`)}
            >
              View Profile
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Export */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(partners)}
        >
          Export CSV
        </Button>
      </div>

      {/* Comparison table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-0 border-b">
          <CardTitle className="font-serif text-lg">
            Side-by-Side Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-semibold bg-muted/30 sticky left-0 min-w-[160px]">
                  Metric
                </th>
                {partners.map((p) => (
                  <th
                    key={p.partner_id}
                    className="px-4 py-3 text-left text-sm font-semibold min-w-[180px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/partners/${p.partner_id}`}
                          className="hover:underline"
                        >
                          {p.firm_name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-normal">
                          {p.contact_name}
                        </p>
                      </div>
                      {onRemove && (
                        <button
                          onClick={() => onRemove(p.partner_id)}
                          className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                          title="Remove from comparison"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ── Overview ── */}
              <SectionHeader label="Overview" />
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  Availability
                </td>
                {partners.map((p) => (
                  <Cell key={p.partner_id}>
                    <Badge
                      variant={AVAIL_VARIANT[p.availability_status] ?? "outline"}
                    >
                      {AVAIL_LABELS[p.availability_status] ?? p.availability_status}
                    </Badge>
                  </Cell>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  Compliance Verified
                </td>
                {partners.map((p) => (
                  <Cell key={p.partner_id}>
                    {p.compliance_verified ? (
                      <CheckIcon className="h-4 w-4 text-green-600" />
                    ) : (
                      <XIcon className="h-4 w-4 text-red-500" />
                    )}
                  </Cell>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  Capabilities
                </td>
                {partners.map((p) => (
                  <Cell key={p.partner_id}>
                    <div className="flex flex-wrap gap-1">
                      {p.capabilities.slice(0, 4).map((c) => (
                        <Badge key={c} variant="secondary" className="text-xs">
                          {c}
                        </Badge>
                      ))}
                      {p.capabilities.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{p.capabilities.length - 4}
                        </Badge>
                      )}
                      {p.capabilities.length === 0 && (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </div>
                  </Cell>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  Geographies
                </td>
                {partners.map((p) => (
                  <Cell key={p.partner_id}>
                    <div className="flex flex-wrap gap-1">
                      {p.geographies.slice(0, 3).map((g) => (
                        <Badge key={g} variant="outline" className="text-xs">
                          {g}
                        </Badge>
                      ))}
                      {p.geographies.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{p.geographies.length - 3}
                        </Badge>
                      )}
                      {p.geographies.length === 0 && (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </div>
                  </Cell>
                ))}
              </tr>

              {/* ── Composite Score ── */}
              <SectionHeader label="Composite Performance Score" />
              <MetricRow
                label="Composite Score (/100)"
                values={compositeScores}
                showProgress
                progressMax={100}
              />

              {/* ── Quality Ratings ── */}
              <SectionHeader label="Quality Ratings (1–5 scale)" />
              <MetricRow
                label="Overall Rating"
                values={partners.map((p) => p.avg_overall)}
                showProgress
                progressMax={5}
              />
              <MetricRow
                label="Quality"
                values={partners.map((p) => p.avg_quality)}
                showProgress
                progressMax={5}
              />
              <MetricRow
                label="Timeliness"
                values={partners.map((p) => p.avg_timeliness)}
                showProgress
                progressMax={5}
              />
              <MetricRow
                label="Communication"
                values={partners.map((p) => p.avg_communication)}
                showProgress
                progressMax={5}
              />
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  Total Ratings
                </td>
                {partners.map((p) => (
                  <Cell key={p.partner_id}>
                    <span className="text-muted-foreground">{p.total_ratings}</span>
                  </Cell>
                ))}
              </tr>

              {/* ── SLA Compliance ── */}
              <SectionHeader label="SLA Compliance" />
              <MetricRow
                label="SLA Compliance Rate"
                values={partners.map((p) => p.sla_compliance_rate)}
                format={fmtPct}
                showProgress
                progressMax={100}
              />
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  SLA Breaches / Tracked
                </td>
                {partners.map((p) => (
                  <Cell key={p.partner_id}>
                    <span
                      className={
                        p.total_sla_breached > 0
                          ? "text-red-600 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {p.total_sla_breached}/{p.total_sla_tracked}
                    </span>
                  </Cell>
                ))}
              </tr>

              {/* ── Capacity ── */}
              <SectionHeader label="Current Capacity" />
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  Remaining Capacity
                </td>
                {(() => {
                  const bi = bestIdx(partners.map((p) => p.remaining_capacity));
                  return partners.map((p, i) => (
                    <Cell key={p.partner_id} highlight={bi === i}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              bi === i
                                ? "font-semibold text-green-700"
                                : ""
                            }
                          >
                            {p.remaining_capacity}/{p.max_concurrent_assignments}
                          </span>
                          {bi === i && (
                            <TrophyIcon className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <Progress
                          value={p.capacity_utilisation}
                          className="h-1.5"
                        />
                        <span className="text-xs text-muted-foreground">
                          {fmtPct(p.capacity_utilisation)} utilised
                        </span>
                      </div>
                    </Cell>
                  ));
                })()}
              </tr>
              <MetricRow
                label="Active Assignments"
                values={partners.map((p) => p.active_assignments)}
                lowerIsBetter
                format={(v) => fmtNum(v, 0)}
              />
              <MetricRow
                label="Total Completed"
                values={partners.map((p) => p.completed_assignments)}
                format={(v) => fmtNum(v, 0)}
              />

              {/* ── Recent Trend ── */}
              <SectionHeader label="Recent Performance Trend (90 days)" />
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  Recent Avg Rating
                </td>
                {partners.map((p) => (
                  <Cell key={p.partner_id}>
                    <div className="flex items-center gap-1.5">
                      <span>{fmtNum(p.avg_recent_overall)}</span>
                      {p.trend_direction === "up" && (
                        <ArrowUpIcon className="h-3.5 w-3.5 text-green-600" />
                      )}
                      {p.trend_direction === "down" && (
                        <ArrowDownIcon className="h-3.5 w-3.5 text-red-500" />
                      )}
                      {p.trend_direction === "neutral" && (
                        <MinusIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </Cell>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium border-b border-border bg-muted/30 sticky left-0">
                  Trend vs All-Time
                </td>
                {partners.map((p) => (
                  <Cell key={p.partner_id}>
                    {p.trend_direction === "up" ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 border-green-200 gap-1"
                      >
                        <ArrowUpIcon className="h-3 w-3" />
                        Improving
                      </Badge>
                    ) : p.trend_direction === "down" ? (
                      <Badge variant="destructive" className="gap-1">
                        <ArrowDownIcon className="h-3 w-3" />
                        Declining
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <MinusIcon className="h-3 w-3" />
                        Stable
                      </Badge>
                    )}
                  </Cell>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

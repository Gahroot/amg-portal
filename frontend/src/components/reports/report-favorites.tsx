"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarClock,
  FileText,
  PlayCircle,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  addReportFavorite,
  getReportFavorites,
  removeReportFavorite,
} from "@/lib/api/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DashboardReportType = "rm_portfolio" | "escalation_log" | "compliance" | "annual_review";

export interface ReportMeta {
  value: DashboardReportType;
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export const DASHBOARD_REPORT_META: ReportMeta[] = [
  {
    value: "rm_portfolio",
    label: "RM Portfolio",
    description: "Client portfolio, program health, and revenue pipeline by relationship manager",
    href: "/reports/rm-portfolio",
    icon: Users,
  },
  {
    value: "escalation_log",
    label: "Escalation Log",
    description: "All escalations with owner, age, resolution status, and time-to-resolve metrics",
    href: "/reports/escalation-log",
    icon: TrendingUp,
  },
  {
    value: "compliance",
    label: "Compliance Audit",
    description: "KYC status, access anomalies, and user account overview",
    href: "/reports/compliance",
    icon: ShieldCheck,
  },
  {
    value: "annual_review",
    label: "Annual Review",
    description: "Year-in-review covering program activity, partner performance, and engagement value",
    href: "/reports/schedules",
    icon: BarChart3,
  },
];

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useReportFavorites() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["report-favorites"],
    queryFn: getReportFavorites,
  });

  const favorites = data?.favorites ?? [];

  const addMutation = useMutation({
    mutationFn: addReportFavorite,
    onSuccess: (result) => {
      queryClient.setQueryData(["report-favorites"], result);
    },
    onError: () => {
      toast.error("Failed to add favorite");
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeReportFavorite,
    onSuccess: (result) => {
      queryClient.setQueryData(["report-favorites"], result);
    },
    onError: () => {
      toast.error("Failed to remove favorite");
    },
  });

  const toggle = (reportType: string) => {
    if (favorites.includes(reportType)) {
      removeMutation.mutate(reportType);
    } else {
      addMutation.mutate(reportType);
    }
  };

  const isPending = addMutation.isPending || removeMutation.isPending;

  return { favorites, isLoading, toggle, isPending };
}

// ─── FavoriteStarButton ──────────────────────────────────────────────────────

interface FavoriteStarButtonProps {
  reportType: string;
  className?: string;
  size?: "sm" | "default";
}

export function FavoriteStarButton({
  reportType,
  className,
  size = "sm",
}: FavoriteStarButtonProps) {
  const { favorites, toggle, isPending } = useReportFavorites();
  const isFavorited = favorites.includes(reportType);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        "shrink-0 transition-colors",
        isFavorited
          ? "text-amber-500 hover:text-amber-600 dark:text-amber-400"
          : "text-muted-foreground hover:text-amber-500",
        className,
      )}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(reportType);
      }}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Star className={cn("h-4 w-4", isFavorited && "fill-current")} />
    </Button>
  );
}

// ─── ReportFavoritesSection ──────────────────────────────────────────────────

interface ReportFavoritesSectionProps {
  onSelectReport: (reportType: DashboardReportType) => void;
}

export function ReportFavoritesSection({ onSelectReport }: ReportFavoritesSectionProps) {
  const { favorites, isLoading } = useReportFavorites();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">Favorites</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const favoriteReports = DASHBOARD_REPORT_META.filter((r) => favorites.includes(r.value));

  if (favoriteReports.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
        <h2 className="text-sm font-semibold text-foreground">Favorites</h2>
        <span className="text-xs text-muted-foreground">({favoriteReports.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {favoriteReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card
              key={report.value}
              className="group cursor-pointer border transition-colors hover:border-primary/40 hover:bg-accent/30"
              onClick={() => onSelectReport(report.value)}
            >
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-medium">{report.label}</CardTitle>
                  </div>
                  <FavoriteStarButton reportType={report.value} />
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <CardDescription className="line-clamp-2 text-xs">
                  {report.description}
                </CardDescription>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 gap-1.5 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReport(report.value);
                    }}
                  >
                    <PlayCircle className="h-3 w-3" />
                    Run
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href="/reports/schedules">
                      <CalendarClock className="h-3 w-3" />
                      Schedule
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── FavoriteReportsWidget (dashboard widget) ────────────────────────────────

interface FavoriteReportsWidgetProps {
  className?: string;
}

export function FavoriteReportsWidget({ className }: FavoriteReportsWidgetProps) {
  const { favorites, isLoading } = useReportFavorites();

  const favoriteReports = DASHBOARD_REPORT_META.filter((r) => favorites.includes(r.value));

  if (!isLoading && favoriteReports.length === 0) {
    return null;
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
          <CardTitle className="text-sm font-semibold">Favorite Reports</CardTitle>
        </div>
        <CardDescription className="text-xs">Quick access to your pinned reports</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {isLoading ? (
          <>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </>
        ) : (
          favoriteReports.map((report) => {
            const Icon = report.icon;
            return (
              <div
                key={report.value}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{report.label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Button size="sm" variant="default" className="h-6 gap-1 px-2 text-xs" asChild>
                    <Link href="/reports">
                      <PlayCircle className="h-3 w-3" />
                      Run
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-xs"
                    asChild
                  >
                    <Link href="/reports/schedules">
                      <CalendarClock className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })
        )}
        <div className="pt-1">
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" asChild>
            <Link href="/reports">
              <FileText className="h-3.5 w-3.5" />
              All Reports
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

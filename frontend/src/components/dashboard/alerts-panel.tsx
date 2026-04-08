"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardAlert } from "@/lib/api/dashboard";

const SEVERITY_CONFIG: Record<
  string,
  { icon: React.ReactNode; badge: string; border: string }
> = {
  critical: {
    icon: <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
    badge: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300",
    border: "border-l-red-500",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    badge: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300",
    border: "border-l-amber-500",
  },
  info: {
    icon: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
    badge: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300",
    border: "border-l-blue-500",
  },
};

interface AlertsPanelProps {
  alerts: DashboardAlert[] | undefined;
  isLoading: boolean;
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  const config = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;

  const content = (
    <div
      className={`flex items-start gap-3 rounded-md border-l-4 p-3 transition-colors hover:bg-muted/50 ${config.border}`}
    >
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium leading-snug">
            {alert.title}
          </p>
          <Badge
            variant="outline"
            className={`shrink-0 text-xs ${config.badge}`}
          >
            {alert.severity}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {alert.description}
        </p>
      </div>
    </div>
  );

  if (alert.link) {
    return <Link href={alert.link}>{content}</Link>;
  }
  return content;
}

export function AlertsPanel({ alerts, isLoading }: AlertsPanelProps) {
  const criticalCount =
    alerts?.filter((a) => a.severity === "critical").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Alerts
          {criticalCount > 0 && (
            <Badge variant="destructive" className="ml-1 text-xs">
              {criticalCount} critical
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Actionable items requiring your attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3 border-l-4 p-3">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts && alerts.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active alerts. Everything looks good!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

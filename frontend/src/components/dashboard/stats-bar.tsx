"use client";

import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckSquare,
  Clock,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/use-count-up";
import type { RealTimeStats } from "@/lib/api/dashboard";

interface StatsBarProps {
  stats: RealTimeStats | undefined;
  isLoading: boolean;
}

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  alert?: boolean;
}

function StatItem({ label, value, icon, alert = false }: StatItemProps) {
  const isAlert = alert && value > 0;
  const animatedValue = useCountUp(value);
  return (
    <Card
      className={
        isAlert ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30" : ""
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={`text-[11px] font-medium uppercase tracking-widest ${
            isAlert ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
          }`}
        >
          {label}
        </CardTitle>
        <span
          className={`rounded-lg p-2 ${
            isAlert ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-primary/10 text-muted-foreground"
          }`}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <p
          className={`text-2xl font-light tabular-nums tracking-tight ${isAlert ? "text-red-700 dark:text-red-300" : ""}`}
        >
          {animatedValue}
        </p>
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-12" />
      </CardContent>
    </Card>
  );
}

export function StatsBar({ stats, isLoading }: StatsBarProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <StatItem
        label="Active Programs"
        value={stats.active_programs}
        icon={<Zap className="h-4 w-4" />}
      />
      <StatItem
        label="Open Escalations"
        value={stats.open_escalations}
        icon={<AlertTriangle className="h-4 w-4" />}
        alert
      />
      <StatItem
        label="SLA Breaches"
        value={stats.sla_breaches}
        icon={<Clock className="h-4 w-4" />}
        alert
      />
      <StatItem
        label="Pending Approvals"
        value={stats.pending_approvals}
        icon={<CheckSquare className="h-4 w-4" />}
        alert
      />
      <StatItem
        label="Unread Messages"
        value={stats.unread_notifications}
        icon={<Bell className="h-4 w-4" />}
      />
      <StatItem
        label="Upcoming Deadlines"
        value={stats.upcoming_deadlines}
        icon={<Calendar className="h-4 w-4" />}
      />
    </div>
  );
}

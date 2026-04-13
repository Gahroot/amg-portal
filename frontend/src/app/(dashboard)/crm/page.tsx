"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  UserPlus,
  Kanban,
  TrendingUp,
  DollarSign,
  Target,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLeads, usePipelineSummary } from "@/hooks/use-crm";
import { OPPORTUNITY_STAGES } from "@/types/crm";

function formatCurrency(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CrmOverviewPage() {
  const { data: pipeline } = usePipelineSummary();
  const { data: leads } = useLeads({ limit: 200 });

  const totalPipeline = (pipeline ?? [])
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .reduce((acc, s) => acc + Number(s.total_value), 0);
  const weightedPipeline = (pipeline ?? [])
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .reduce((acc, s) => acc + Number(s.weighted_value), 0);
  const wonValue = Number(
    pipeline?.find((s) => s.stage === "won")?.total_value ?? 0,
  );
  const activeLeads = (leads?.leads ?? []).filter(
    (l) => l.status !== "converted" && l.status !== "disqualified",
  ).length;

  const stats = [
    {
      label: "Active leads",
      value: activeLeads.toString(),
      icon: UserPlus,
      href: "/crm/leads",
    },
    {
      label: "Open pipeline",
      value: formatCurrency(totalPipeline),
      icon: TrendingUp,
      href: "/crm/pipeline",
    },
    {
      label: "Weighted pipeline",
      value: formatCurrency(weightedPipeline),
      icon: Target,
      href: "/crm/pipeline",
    },
    {
      label: "Closed won",
      value: formatCurrency(wonValue),
      icon: DollarSign,
      href: "/crm/pipeline",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Leads, pipeline, and pre-intake relationship management.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/crm/leads">
              <UserPlus className="size-4" />
              Leads
            </Link>
          </Button>
          <Button asChild>
            <Link href="/crm/pipeline">
              <Kanban className="size-4" />
              Pipeline
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
          >
            <Link href={stat.href}>
              <Card className="p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <stat.icon className="size-5" />
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-serif text-lg font-semibold">Pipeline by stage</h2>
        <div className="mt-4 space-y-3">
          {OPPORTUNITY_STAGES.map((stage) => {
            const row = pipeline?.find((p) => p.stage === stage.value);
            const count = row?.count ?? 0;
            const value = Number(row?.total_value ?? 0);
            return (
              <div key={stage.value} className="flex items-center gap-3">
                <div className="w-32 text-sm">{stage.label}</div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(100, (value / Math.max(1, totalPipeline + wonValue)) * 100)}%`,
                      }}
                      transition={{ duration: 0.4 }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
                <div className="w-12 text-right text-sm text-muted-foreground">
                  {count}
                </div>
                <div className="w-24 text-right text-sm font-medium">
                  {formatCurrency(value)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

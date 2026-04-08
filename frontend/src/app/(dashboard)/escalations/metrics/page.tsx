"use client";

import { Suspense } from "react";
import { useAuth } from "@/providers/auth-provider";
import { EscalationMetricsDashboard } from "@/components/escalations/metrics-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

function EscalationMetricsPageContent() {
  const { user } = useAuth();

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <EscalationMetricsDashboard />
      </div>
    </div>
  );
}

export default function EscalationMetricsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-6">
          <Skeleton className="h-9 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <EscalationMetricsPageContent />
    </Suspense>
  );
}

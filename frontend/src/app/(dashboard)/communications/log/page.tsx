"use client";

import { Suspense } from "react";
import { useAuth } from "@/providers/auth-provider";
import { CommunicationLogList } from "@/components/communication-logs/communication-log-list";
import { TableSkeleton } from "@/components/ui/loading-skeletons";

const INTERNAL_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

function CommunicationLogPageContent() {
  const { user } = useAuth();

  if (!user || !INTERNAL_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl">
        <CommunicationLogList />
      </div>
    </div>
  );
}

export default function CommunicationLogPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FDFBF7] p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <TableSkeleton rows={6} columns={7} />
          </div>
        </div>
      }
    >
      <CommunicationLogPageContent />
    </Suspense>
  );
}

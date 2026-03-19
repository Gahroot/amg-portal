"use client";

import { PartnerGovernanceDashboard } from "@/components/partners/partner-governance-dashboard";

export default function GovernanceDashboardPage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Partner Governance
          </h1>
          <p className="text-muted-foreground mt-1">
            Performance scores, SLA compliance, and governance status for all
            partners.
          </p>
        </div>
        <PartnerGovernanceDashboard />
      </div>
    </div>
  );
}

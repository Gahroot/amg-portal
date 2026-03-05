"use client";

import { usePortalProfile } from "@/hooks/use-clients";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  approved: "Active",
  pending_review: "Under Review",
  under_review: "Under Review",
  pending_compliance: "Under Review",
  compliance_cleared: "Under Review",
  pending_md_approval: "Under Review",
  draft: "Pending",
  flagged: "Requires Attention",
  rejected: "Inactive",
};

export default function PortalDashboardPage() {
  const { data: profile, isLoading } = usePortalProfile();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground">Profile not available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Welcome, {profile.display_name || profile.legal_name}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {STATUS_LABELS[profile.approval_status] ?? profile.approval_status}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Profile Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Entity Type</p>
              <p className="text-sm">{profile.entity_type || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jurisdiction</p>
              <p className="text-sm">{profile.jurisdiction || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-sm">{profile.primary_email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Programs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Communications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

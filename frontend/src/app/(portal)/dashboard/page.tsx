"use client";

import Link from "next/link";
import { usePortalProfile } from "@/hooks/use-clients";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

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

        <Link href="/portal/programs">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Programs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View your programs, milestones, and deliverables</p>
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto">
                View Programs <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/decisions">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Decisions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Review and respond to pending decision requests</p>
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto">
                View Decisions <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/reports">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Access status reports, completion summaries, and annual reviews</p>
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto">
                View Reports <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

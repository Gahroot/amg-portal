"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useClientProfiles } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";

const ALLOWED_ROLES = [
  "finance_compliance",
  "managing_director",
  "relationship_manager",
  "coordinator",
];

const KYC_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  cleared: "default",
  pending_review: "secondary",
  under_review: "secondary",
  flagged: "destructive",
  rejected: "destructive",
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  variant,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: "default" | "warning" | "success" | "destructive";
}) {
  const colorMap = {
    default: "text-muted-foreground",
    warning: "text-amber-600",
    success: "text-green-600",
    destructive: "text-red-600",
  };
  const iconColor = colorMap[variant ?? "default"];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function getExpiringCount(
  profiles: Array<{ compliance_status: string; created_at: string }>,
): number {
  const now = new Date();
  const thresholdMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  return profiles.filter((p) => {
    if (p.compliance_status !== "cleared") return false;
    const created = new Date(p.created_at);
    const ageMs = now.getTime() - created.getTime();
    // Treat profiles cleared more than 335 days ago as expiring soon (within 30 days of 1-year anniversary)
    return ageMs > 365 * 24 * 60 * 60 * 1000 - thresholdMs;
  }).length;
}

export default function KycDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<string | undefined>(
    undefined,
  );
  const [search, setSearch] = React.useState<string>("");

  const { data: allData, isLoading: allLoading } = useClientProfiles({});
  const { data: filteredData, isLoading: filteredLoading } = useClientProfiles({
    compliance_status: statusFilter,
    search: search || undefined,
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const profiles = allData?.profiles ?? [];
  const pendingCount = profiles.filter(
    (p) => p.compliance_status === "pending_review",
  ).length;
  const underReviewCount = profiles.filter(
    (p) => p.compliance_status === "under_review",
  ).length;
  const verifiedCount = profiles.filter(
    (p) => p.compliance_status === "cleared",
  ).length;
  const expiringCount = getExpiringCount(profiles);

  const flaggedProfiles = profiles.filter(
    (p) =>
      p.compliance_status === "flagged" ||
      p.compliance_status === "rejected",
  );

  const queueProfiles = filteredData?.profiles ?? [];
  const isLoading = allLoading || filteredLoading;

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            KYC Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/kyc/alerts">Alerts</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/kyc/reports">Reports</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/kyc/verifications">Verifications</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/compliance">Compliance Queue</Link>
            </Button>
            <Button asChild>
              <Link href="/clients/new">New Client</Link>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {allLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading summary...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <SummaryCard
              label="Pending Review"
              value={pendingCount}
              icon={Clock}
              variant="warning"
            />
            <SummaryCard
              label="In Progress"
              value={underReviewCount}
              icon={ShieldCheck}
              variant="default"
            />
            <SummaryCard
              label="Verified"
              value={verifiedCount}
              icon={CheckCircle}
              variant="success"
            />
            <SummaryCard
              label="Expiring Soon"
              value={expiringCount}
              icon={AlertTriangle}
              variant={expiringCount > 0 ? "destructive" : "default"}
            />
          </div>
        )}

        {/* Recent Alerts */}
        {flaggedProfiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {flaggedProfiles.slice(0, 5).map((profile) => (
                  <li
                    key={profile.id}
                    className="flex items-center justify-between rounded-md border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          KYC_STATUS_VARIANT[profile.compliance_status] ??
                          "outline"
                        }
                      >
                        {profile.compliance_status.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-sm font-medium">
                        {profile.display_name || profile.legal_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {profile.entity_type ?? "—"}
                      </span>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                    >
                      <Link href={`/clients/${profile.id}`}>
                        Review
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Verification Queue */}
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold">
            Verification Queue
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            <Input
              placeholder="Search clients..."
              className="max-w-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              onValueChange={(value) =>
                setStatusFilter(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="KYC Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">
              Loading verification queue...
            </p>
          ) : (
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>KYC Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueProfiles.map((profile) => (
                    <TableRow
                      key={profile.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/clients/${profile.id}`)}
                    >
                      <TableCell className="font-medium">
                        {profile.display_name || profile.legal_name}
                      </TableCell>
                      <TableCell>{profile.entity_type ?? "—"}</TableCell>
                      <TableCell>{profile.jurisdiction ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            KYC_STATUS_VARIANT[profile.compliance_status] ??
                            "outline"
                          }
                        >
                          {profile.compliance_status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(profile.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          asChild
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/compliance/${profile.id}`}>
                            Review
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {queueProfiles.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No clients found in the verification queue.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredData && (
            <p className="text-sm text-muted-foreground">
              {filteredData.total} client{filteredData.total !== 1 ? "s" : ""}{" "}
              total
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/compliance">Review Pending KYC</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/clients">View All Clients</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/approvals">MD Approvals</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/reports">Generate Report</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

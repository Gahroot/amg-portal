"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useClientProfiles } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClientListParams } from "@/types/client";

const INTERNAL_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

const COMPLIANCE_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  cleared: "default",
  pending_review: "secondary",
  under_review: "secondary",
  flagged: "destructive",
  rejected: "destructive",
};

const APPROVAL_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  approved: "default",
  pending_compliance: "secondary",
  compliance_cleared: "secondary",
  pending_md_approval: "secondary",
  flagged: "destructive",
  rejected: "destructive",
  draft: "outline",
};

export default function ClientsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filters, setFilters] = React.useState<ClientListParams>({});

  const { data, isLoading } = useClientProfiles(filters);

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
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Client Profiles
          </h1>
          <Button asChild>
            <Link href="/clients/new">New Client</Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="Search clients..."
            className="max-w-xs"
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value || undefined }))
            }
          />
          <Select
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                compliance_status: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Compliance Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="cleared">Cleared</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                approval_status: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Approval Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_compliance">
                Pending Compliance
              </SelectItem>
              <SelectItem value="compliance_cleared">
                Compliance Cleared
              </SelectItem>
              <SelectItem value="pending_md_approval">
                Pending MD Approval
              </SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading clients...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.profiles.map((profile) => (
                  <TableRow
                    key={profile.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/clients/${profile.id}`)}
                  >
                    <TableCell className="font-medium">
                      {profile.display_name || profile.legal_name}
                    </TableCell>
                    <TableCell>{profile.entity_type ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          COMPLIANCE_STATUS_VARIANT[profile.compliance_status] ??
                          "outline"
                        }
                      >
                        {profile.compliance_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          APPROVAL_STATUS_VARIANT[profile.approval_status] ??
                          "outline"
                        }
                      >
                        {profile.approval_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(profile.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {data?.profiles.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No clients found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} client{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}

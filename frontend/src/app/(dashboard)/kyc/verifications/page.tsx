"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listAllKYCVerifications } from "@/lib/api/kyc-verifications";
import { listClientProfiles } from "@/lib/api/clients";
import type { KYCVerificationStatus } from "@/types/kyc-verification";
import { Button } from "@/components/ui/button";
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
import { VerificationStatusBadge } from "@/components/kyc/verification-status-badge";
import { DocumentTypeBadge } from "@/components/kyc/document-type-badge";

const ALLOWED_ROLES = [
  "finance_compliance",
  "managing_director",
  "relationship_manager",
  "coordinator",
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected" },
];

export default function VerificationsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [clientFilter, setClientFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const isAllowed = user && ALLOWED_ROLES.includes(user.role);

  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClientProfiles({ limit: 200 }),
    enabled: !!isAllowed,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "kyc-verifications",
      statusFilter,
      clientFilter,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      listAllKYCVerifications({
        status:
          statusFilter !== "all"
            ? (statusFilter as KYCVerificationStatus)
            : undefined,
        client_id: clientFilter !== "all" ? clientFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    enabled: !!isAllowed,
  });

  if (!isAllowed) {
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
            KYC Verifications
          </h1>
          <Button asChild>
            <Link href="/kyc/verifications/new">New Verification</Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clientsData?.profiles.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.display_name || client.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-[160px]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              className="w-[160px]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">
            Loading verifications...
          </p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.kyc_documents.map((verification) => (
                  <TableRow key={verification.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/clients/${verification.client_id}`}
                        className="hover:underline"
                      >
                        {verification.client_name ?? "Unknown Client"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <DocumentTypeBadge type={verification.document_type} />
                    </TableCell>
                    <TableCell>
                      <VerificationStatusBadge status={verification.status} />
                    </TableCell>
                    <TableCell>
                      {verification.expiry_date
                        ? new Date(
                            verification.expiry_date,
                          ).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(verification.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/kyc/verifications/${verification.id}?client_id=${verification.client_id}`}
                        >
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.kyc_documents.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No verifications found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} verification{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
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
import { useClientProfiles } from "@/hooks/use-clients";
import { useKYCDocuments } from "@/hooks/use-kyc-documents";
import type { KYCDocumentStatus } from "@/types/document";

const STATUS_VARIANT: Record<
  KYCDocumentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  verified: "default",
  pending: "secondary",
  expired: "destructive",
  rejected: "destructive",
};

const KYC_TYPES = [
  "passport",
  "national_id",
  "proof_of_address",
  "tax_id",
  "bank_statement",
  "source_of_wealth",
  "other",
];

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function ClientKYCRows({
  clientId,
  clientName,
  statusFilter,
  typeFilter,
  search,
}: {
  clientId: string;
  clientName: string;
  statusFilter: string;
  typeFilter: string;
  search: string;
}) {
  const router = useRouter();
  const { data } = useKYCDocuments(clientId);

  const docs = (data?.kyc_documents ?? []).filter((doc) => {
    if (statusFilter && statusFilter !== "all" && doc.status !== statusFilter)
      return false;
    if (typeFilter && typeFilter !== "all" && doc.document_type !== typeFilter)
      return false;
    if (
      search &&
      !clientName.toLowerCase().includes(search.toLowerCase()) &&
      !doc.document_type.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  if (docs.length === 0) return null;

  return (
    <>
      {docs.map((doc) => (
        <TableRow
          key={doc.id}
          className="cursor-pointer"
          onClick={() =>
            router.push(`/kyc/verifications/${doc.id}?client=${clientId}`)
          }
        >
          <TableCell className="font-medium">{clientName}</TableCell>
          <TableCell>
            <Badge variant="outline">{formatLabel(doc.document_type)}</Badge>
          </TableCell>
          <TableCell>
            <Badge
              variant={
                STATUS_VARIANT[doc.status as KYCDocumentStatus] ?? "outline"
              }
            >
              {formatLabel(doc.status)}
            </Badge>
          </TableCell>
          <TableCell>
            {doc.expiry_date
              ? new Date(doc.expiry_date).toLocaleDateString()
              : "—"}
          </TableCell>
          <TableCell>
            {new Date(doc.created_at).toLocaleDateString()}
          </TableCell>
          <TableCell>
            <Button
              variant="outline"
              size="sm"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/kyc/verifications/${doc.id}?client=${clientId}`}>
                View
              </Link>
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function KYCVerificationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: clientsData, isLoading: clientsLoading } = useClientProfiles(
    {},
  );
  const clients = clientsData?.profiles ?? [];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              KYC Verifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All KYC documents across clients
            </p>
          </div>
          <Button asChild>
            <Link href="/kyc/verifications/new">
              <Plus className="size-4" />
              Upload Document
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search client or type..."
              className="max-w-xs pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Document Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {KYC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {formatLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {clientsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <ClientKYCRows
                    key={client.id}
                    clientId={client.id}
                    clientName={
                      client.display_name ?? client.legal_name
                    }
                    statusFilter={statusFilter}
                    typeFilter={typeFilter}
                    search={search}
                  />
                ))}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
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
      </div>
    </div>
  );
}

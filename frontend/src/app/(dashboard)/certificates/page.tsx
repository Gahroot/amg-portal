"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useCertificates } from "@/hooks/use-certificates";
import { downloadCertificatePDF } from "@/lib/api/clearance-certificates";
import type { ClearanceCertificate, CertificateStatus } from "@/lib/api/clearance-certificates";

const ALLOWED_ROLES = ["finance_compliance", "managing_director", "relationship_manager", "coordinator"];

const statusColors: Record<CertificateStatus, string> = {
  draft: "bg-muted text-foreground",
  issued: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  revoked: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  expired: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
};

export default function CertificatesPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState<CertificateStatus | "all">("all");

  const params = statusFilter !== "all" ? { status: statusFilter } : undefined;
  const { data, isLoading } = useCertificates(params);
  const certificates = data?.certificates ?? [];
  const total = data?.total ?? 0;

  const handleDownload = async (cert: ClearanceCertificate) => {
    try {
      await downloadCertificatePDF(cert.id, cert.certificate_number);
    } catch (error) {
      console.error("Failed to download certificate:", error);
    }
  };

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const canCreate = user.role === "finance_compliance" || user.role === "managing_director";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Clearance Certificates
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage compliance clearance certificates for clients and programs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/certificates/templates">Templates</Link>
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/certificates/new">New Certificate</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as CertificateStatus | "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-mono text-sm">
                    {cert.certificate_number}
                  </TableCell>
                  <TableCell className="font-medium">{cert.title}</TableCell>
                  <TableCell>{cert.client_name}</TableCell>
                  <TableCell className="capitalize">
                    {cert.certificate_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[cert.status]}>
                      {cert.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {cert.issue_date
                      ? new Date(cert.issue_date).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/certificates/${cert.id}`}>View</Link>
                      </Button>
                      {cert.status === "issued" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(cert)}
                        >
                          PDF
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {certificates.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No certificates found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 && (
        <p className="text-sm text-muted-foreground">
          {total} certificate{total !== 1 ? "s" : ""} total
        </p>
      )}
    </div>
  );
}

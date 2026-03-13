"use client";

import * as React from "react";
import Link from "next/link";
import { FileSignature, Clock, CheckCircle2, XCircle, Send, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useEnvelopes } from "@/hooks/use-envelopes";
import type { EnvelopeStatus } from "@/types/document";

const STATUS_CONFIG: Record<
  EnvelopeStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  created: { label: "Created", variant: "outline", icon: Clock },
  sent: { label: "Sent", variant: "secondary", icon: Send },
  delivered: { label: "Delivered", variant: "secondary", icon: Send },
  signed: { label: "Signed", variant: "default", icon: CheckCircle2 },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
  declined: { label: "Declined", variant: "destructive", icon: XCircle },
  voided: { label: "Voided", variant: "destructive", icon: XCircle },
  expired: { label: "Expired", variant: "outline", icon: Clock },
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Envelopes" },
  { value: "sent", label: "Awaiting Signature" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "voided", label: "Voided" },
];

function canSign(status: EnvelopeStatus): boolean {
  return status === "sent" || status === "delivered";
}

export function EnvelopeList() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const { data, isLoading, error } = useEnvelopes(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );

  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading envelopes…
      </p>
    );
  }

  // Handle DocuSign not configured (503)
  if (error) {
    const isNotConfigured =
      error instanceof Error &&
      (error.message.includes("503") ||
        error.message.includes("not configured"));

    if (isNotConfigured) {
      return (
        <div className="flex flex-col items-center gap-3 py-12">
          <FileSignature className="size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">DocuSign Not Configured</p>
          <p className="text-xs text-muted-foreground text-center max-w-md">
            Document signing is not available. Please contact your administrator
            to configure the DocuSign integration.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <FileSignature className="size-10 text-destructive/50" />
        <p className="text-sm text-destructive">
          Failed to load envelopes. Please try again.
        </p>
      </div>
    );
  }

  const envelopes = data?.envelopes ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} envelope{(data?.total ?? 0) !== 1 ? "s" : ""}
        </p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {envelopes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <FileSignature className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No envelopes found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {envelopes.map((envelope) => {
              const config = STATUS_CONFIG[envelope.status] ?? STATUS_CONFIG.created;
              const StatusIcon = config.icon;

              return (
                <TableRow key={envelope.id}>
                  <TableCell className="max-w-[250px] truncate font-medium">
                    {envelope.subject}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {envelope.sender_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon className="size-3" />
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {envelope.sent_at
                      ? new Date(envelope.sent_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {canSign(envelope.status) ? (
                      <Button size="sm" asChild>
                        <Link href={`/portal/documents/signing/${envelope.id}`}>
                          <FileSignature className="mr-1 size-3" />
                          Sign
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/portal/documents/signing/${envelope.id}`}>
                          <Eye className="mr-1 size-3" />
                          View
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

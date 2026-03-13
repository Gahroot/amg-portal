"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature } from "lucide-react";
import { useEnvelopes } from "@/hooks/use-envelopes";
import type { EnvelopeListParams } from "@/lib/api/envelopes";
import type { EnvelopeStatus } from "@/types/document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const STATUS_VARIANT: Record<
  EnvelopeStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  created: "outline",
  sent: "secondary",
  delivered: "secondary",
  signed: "default",
  completed: "default",
  declined: "destructive",
  voided: "destructive",
  expired: "destructive",
};

export default function EnvelopesPage() {
  const router = useRouter();
  const [filters, setFilters] = React.useState<EnvelopeListParams>({});
  const { data, isLoading, error } = useEnvelopes(filters);

  // Handle DocuSign not configured (503)
  const isNotConfigured =
    error instanceof Error &&
    (error.message.includes("503") ||
      error.message.includes("not configured"));

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Envelopes
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Select
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                status: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="signed">Signed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isNotConfigured ? (
          <div className="flex flex-col items-center gap-3 rounded-md border bg-white py-12">
            <FileSignature className="size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">DocuSign Not Configured</p>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              Document signing is not available. Please configure the
              DocuSign integration to enable envelope management.
            </p>
          </div>
        ) : isLoading ? (
          <p className="text-muted-foreground text-sm">
            Loading envelopes...
          </p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-md border bg-white py-12">
            <FileSignature className="size-10 text-destructive/50" />
            <p className="text-sm text-destructive">
              Failed to load envelopes. Please try again.
            </p>
          </div>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.envelopes.map((envelope) => {
                  const signable =
                    envelope.status === "sent" ||
                    envelope.status === "delivered";
                  return (
                    <TableRow key={envelope.id}>
                      <TableCell className="font-medium">
                        {envelope.subject}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            STATUS_VARIANT[envelope.status] ?? "outline"
                          }
                        >
                          {envelope.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{envelope.sender_name}</TableCell>
                      <TableCell>
                        {envelope.recipients
                          .map((r) => r.name)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        {envelope.sent_at
                          ? new Date(
                              envelope.sent_at,
                            ).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={signable ? "default" : "outline"}
                          onClick={() =>
                            router.push(
                              `/documents/signing/${envelope.id}`,
                            )
                          }
                        >
                          <FileSignature className="mr-1 size-4" />
                          {signable ? "Sign" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data?.envelopes.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No envelopes found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} envelope{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}

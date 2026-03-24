"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDocumentDeliveries } from "@/hooks/use-documents";

const METHOD_LABELS: Record<string, string> = {
  portal: "Portal",
  email: "Email",
  secure_link: "Secure Link",
};

interface DeliveryTrackerProps {
  documentId: string;
}

export function DeliveryTracker({ documentId }: DeliveryTrackerProps) {
  const { data, isLoading } = useDocumentDeliveries(documentId, true);

  if (isLoading) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Loading deliveries...
      </p>
    );
  }

  const deliveries = data?.deliveries ?? [];

  if (deliveries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No deliveries recorded.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recipient</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Delivered</TableHead>
          <TableHead>Viewed</TableHead>
          <TableHead>Acknowledged</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.map((d) => {
          const status = d.acknowledged_at
            ? "acknowledged"
            : d.viewed_at
              ? "viewed"
              : "delivered";
          return (
            <TableRow key={d.id}>
              <TableCell className="font-mono text-xs">
                {d.recipient_id.slice(0, 8)}…
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {METHOD_LABELS[d.delivery_method] ?? d.delivery_method}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(d.delivered_at).toLocaleString()}
              </TableCell>
              <TableCell>
                {d.viewed_at
                  ? new Date(d.viewed_at).toLocaleString()
                  : "—"}
              </TableCell>
              <TableCell>
                {d.acknowledged_at
                  ? new Date(d.acknowledged_at).toLocaleString()
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    status === "acknowledged"
                      ? "default"
                      : status === "viewed"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {status}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

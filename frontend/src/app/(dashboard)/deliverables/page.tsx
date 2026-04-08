"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listDeliverables, reviewDeliverable } from "@/lib/api/deliverables";
import { useDebounce } from "@/hooks/use-debounce";
import type { DeliverableItem } from "@/types/deliverable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Search, Download } from "lucide-react";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import { API_BASE_URL } from "@/lib/constants";

const EXPORT_COLUMNS: ExportColumn<DeliverableItem>[] = [
  { header: "Title", accessor: "title" },
  { header: "Type", accessor: "deliverable_type" },
  { header: "Status", accessor: (r) => r.status.replace(/_/g, " ") },
  { header: "Due Date", accessor: (r) => r.due_date ? new Date(r.due_date).toLocaleDateString() : "" },
  { header: "Client Visible", accessor: (r) => r.client_visible ? "Yes" : "No" },
  { header: "Submitted At", accessor: (r) => r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "" },
  { header: "Review Comments", accessor: "review_comments" },
  { header: "Created", accessor: (r) => new Date(r.created_at).toLocaleDateString() },
];

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  submitted: "secondary",
  under_review: "secondary",
  approved: "default",
  returned: "destructive",
  rejected: "destructive",
};

type ReviewAction = "approve" | "request_revisions" | "reject";

interface ReviewDialogState {
  deliverable: DeliverableItem;
  action: ReviewAction;
}

function DeliverableTable({
  deliverables,
  onRowClick,
  actions,
}: {
  deliverables: DeliverableItem[];
  onRowClick: (id: string) => void;
  actions?: (d: DeliverableItem) => React.ReactNode;
}) {
  const handleDownload = (e: React.MouseEvent, deliverable: DeliverableItem) => {
    e.stopPropagation();
    if (deliverable.download_url) {
      window.open(deliverable.download_url, "_blank");
    }
  };

  const colSpan = actions ? 7 : 6;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Client Visible</TableHead>
            <TableHead className="w-[60px]">File</TableHead>
            {actions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliverables.map((deliverable) => (
            <TableRow
              key={deliverable.id}
              className="cursor-pointer"
              onClick={() => onRowClick(deliverable.id)}
            >
              <TableCell className="font-medium">{deliverable.title}</TableCell>
              <TableCell>
                <Badge variant="secondary">{deliverable.deliverable_type}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[deliverable.status] ?? "outline"}>
                  {deliverable.status.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>
                {deliverable.due_date
                  ? new Date(deliverable.due_date).toLocaleDateString()
                  : "-"}
              </TableCell>
              <TableCell>{deliverable.client_visible ? "Yes" : "No"}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {deliverable.download_url ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Download file"
                    onClick={(e) => handleDownload(e, deliverable)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              {actions && (
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actions(deliverable)}
                </TableCell>
              )}
            </TableRow>
          ))}
          {deliverables.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="text-center text-muted-foreground"
              >
                No deliverables found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function DeliverablesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const isInternal = user?.role !== "client" && user?.role !== "partner";

  // Read initial values from URL
  const [searchInput, setSearchInput] = React.useState(
    searchParams.get("search") ?? ""
  );
  const debouncedSearch = useDebounce(searchInput, 300);

  const statusParam = searchParams.get("status") ?? "all";

  const updateParam = React.useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  // Sync debounced search to URL
  React.useEffect(() => {
    updateParam("search", debouncedSearch || undefined);
  }, [debouncedSearch, updateParam]);

  const [reviewDialog, setReviewDialog] =
    React.useState<ReviewDialogState | null>(null);
  const [reviewComments, setReviewComments] = React.useState("");

  // All deliverables (filtered tab)
  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ["deliverables", debouncedSearch, statusParam],
    queryFn: () =>
      listDeliverables({
        search: debouncedSearch || undefined,
        status: statusParam !== "all" ? statusParam : undefined,
      }),
    enabled: isInternal,
  });

  // Pending review queue — only "submitted" status
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["deliverables", { status: "submitted" }],
    queryFn: () => listDeliverables({ status: "submitted" }),
    enabled: isInternal,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
      comments,
    }: {
      id: string;
      status: "approved" | "returned" | "rejected";
      comments?: string;
    }) =>
      reviewDeliverable(id, {
        status,
        review_comments: comments,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliverables"] });
      setReviewDialog(null);
      setReviewComments("");
    },
  });

  const handleReviewConfirm = () => {
    if (!reviewDialog) return;
    const { deliverable, action } = reviewDialog;

    const statusMap: Record<ReviewAction, "approved" | "returned" | "rejected"> =
      {
        approve: "approved",
        request_revisions: "returned",
        reject: "rejected",
      };

    reviewMutation.mutate({
      id: deliverable.id,
      status: statusMap[action],
      comments: reviewComments || undefined,
    });
  };

  const openReviewDialog = (
    deliverable: DeliverableItem,
    action: ReviewAction,
  ) => {
    setReviewComments("");
    setReviewDialog({ deliverable, action });
  };

  if (!isInternal) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const pendingCount = pendingData?.total ?? 0;

  const reviewActionLabel: Record<ReviewAction, string> = {
    approve: "Approve Deliverable",
    request_revisions: "Request Revisions",
    reject: "Reject Deliverable",
  };

  const requiresComments: Record<ReviewAction, boolean> = {
    approve: false,
    request_revisions: true,
    reject: true,
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Deliverables
          </h1>
          <DataTableExport
            visibleRows={allData?.deliverables ?? []}
            columns={EXPORT_COLUMNS}
            fileName="deliverables"
            exportAllUrl={(() => {
              const params = new URLSearchParams();
              if (statusParam !== "all") params.set("status", statusParam);
              if (debouncedSearch) params.set("search", debouncedSearch);
              const qs = params.toString();
              return `${API_BASE_URL}/api/v1/export/deliverables${qs ? `?${qs}` : ""}`;
            })()}
          />
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Deliverables</TabsTrigger>
            <TabsTrigger value="pending_review" className="relative">
              Pending Review
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── All Deliverables tab ── */}
          <TabsContent value="all" className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search deliverables..."
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Select
                value={statusParam}
                onValueChange={(value) => updateParam("status", value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {allLoading ? (
              <p className="text-muted-foreground text-sm">
                Loading deliverables...
              </p>
            ) : (
              <DeliverableTable
                deliverables={allData?.deliverables ?? []}
                onRowClick={(id) => router.push(`/deliverables/${id}`)}
              />
            )}

            {allData && (
              <p className="text-sm text-muted-foreground">
                {allData.total} deliverable{allData.total !== 1 ? "s" : ""}{" "}
                total
              </p>
            )}
          </TabsContent>

          {/* ── Pending Review tab ── */}
          <TabsContent value="pending_review" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deliverables submitted by partners awaiting coordinator review.
              Approve to make visible to the client, or request revisions.
            </p>

            {pendingLoading ? (
              <p className="text-muted-foreground text-sm">
                Loading pending reviews...
              </p>
            ) : (
              <DeliverableTable
                deliverables={pendingData?.deliverables ?? []}
                onRowClick={(id) => router.push(`/deliverables/${id}`)}
                actions={(d) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => openReviewDialog(d, "approve")}
                      disabled={reviewMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openReviewDialog(d, "request_revisions")
                      }
                      disabled={reviewMutation.isPending}
                    >
                      Request Revisions
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openReviewDialog(d, "reject")}
                      disabled={reviewMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              />
            )}

            {pendingData && (
              <p className="text-sm text-muted-foreground">
                {pendingData.total} deliverable
                {pendingData.total !== 1 ? "s" : ""} pending review
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Review Confirmation Dialog ── */}
      <Dialog
        open={!!reviewDialog}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDialog(null);
            setReviewComments("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog ? reviewActionLabel[reviewDialog.action] : ""}
            </DialogTitle>
          </DialogHeader>

          {reviewDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {reviewDialog.deliverable.title}
                </span>
              </p>

              {reviewDialog.action === "approve" && (
                <p className="text-sm">
                  Approving this deliverable will make it visible to the client.
                  You may optionally add a note.
                </p>
              )}

              {(reviewDialog.action === "request_revisions" ||
                reviewDialog.action === "reject") && (
                <p className="text-sm">
                  {reviewDialog.action === "request_revisions"
                    ? "Provide comments explaining what revisions are needed."
                    : "Provide a reason for rejecting this deliverable."}
                </p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Comments{" "}
                  {requiresComments[reviewDialog.action] ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-muted-foreground">(optional)</span>
                  )}
                </label>
                <Textarea
                  placeholder={
                    reviewDialog.action === "approve"
                      ? "Optional note for the partner..."
                      : reviewDialog.action === "request_revisions"
                        ? "Describe the required changes..."
                        : "Reason for rejection..."
                  }
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialog(null);
                setReviewComments("");
              }}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={
                reviewDialog?.action === "reject" ? "destructive" : "default"
              }
              onClick={handleReviewConfirm}
              disabled={
                reviewMutation.isPending ||
                (reviewDialog !== null &&
                  requiresComments[reviewDialog.action] &&
                  !reviewComments.trim())
              }
            >
              {reviewMutation.isPending
                ? "Saving..."
                : reviewDialog?.action === "approve"
                  ? "Approve"
                  : reviewDialog?.action === "request_revisions"
                    ? "Request Revisions"
                    : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DeliverablesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading...</div>}>
      <DeliverablesPageContent />
    </Suspense>
  );
}

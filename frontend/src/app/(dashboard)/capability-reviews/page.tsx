"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  listCapabilityReviews,
  getCapabilityReviewStatistics,
  generateAnnualReviews,
} from "@/lib/api/capability-reviews";
import type { CapabilityReviewListParams } from "@/types/capability-review";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const ALLOWED_ROLES = [
  "managing_director",
  "relationship_manager",
  "coordinator",
  "finance_compliance",
];

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  scheduled: "default",
  in_progress: "default",
  completed: "outline",
  overdue: "destructive",
  waived: "secondary",
};

const PAGE_SIZE = 50;

export default function CapabilityReviewsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CapabilityReviewListParams>({});
  const [page, setPage] = useState(0);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateYear, setGenerateYear] = useState(
    new Date().getFullYear()
  );

  const queryParams = { ...filters, skip: page * PAGE_SIZE, limit: PAGE_SIZE };

  const { data, isLoading } = useQuery({
    queryKey: ["capability-reviews", queryParams],
    queryFn: () => listCapabilityReviews(queryParams),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const { data: stats } = useQuery({
    queryKey: ["capability-review-statistics"],
    queryFn: getCapabilityReviewStatistics,
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateAnnualReviews({ review_year: generateYear }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["capability-review-statistics"],
      });
      setShowGenerateDialog(false);
    },
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

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Capability Reviews
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/capability-reviews/new")}>
              New Review
            </Button>
            <Button onClick={() => setShowGenerateDialog(true)}>
              Generate Annual Reviews
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.pending + stats.scheduled}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.completed}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                status: value === "all" ? undefined : value,
              }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                year: value === "all" ? undefined : parseInt(value),
              }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading reviews...</p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.reviews.map((review) => (
                  <TableRow
                    key={review.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/capability-reviews/${review.id}`)}
                  >
                    <TableCell className="font-medium">
                      {review.partner_name || "Unknown"}
                    </TableCell>
                    <TableCell>{review.review_year}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[review.status] ?? "outline"}>
                        {review.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{review.reviewer_name || "-"}</TableCell>
                    <TableCell>
                      {review.scheduled_date
                        ? new Date(review.scheduled_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {review.completed_date
                        ? new Date(review.completed_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {data?.reviews.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No capability reviews found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} review{data?.total !== 1 ? "s" : ""} total
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Annual Reviews</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Review Year</label>
            <Select
              value={generateYear.toString()}
              onValueChange={(v) => setGenerateYear(parseInt(v))}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-sm text-muted-foreground">
              This will create pending reviews for all active partners that do
              not already have a review for {generateYear}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

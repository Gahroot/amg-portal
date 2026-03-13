"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  useNPSSurveys,
  useCreateNPSSurvey,
  useActivateNPSSurvey,
  useCloseNPSSurvey,
} from "@/hooks/use-nps-surveys";
import type {
  NPSSurveyListParams,
  NPSSurveyStatus,
  NPSSurveyCreateData,
} from "@/types/nps-survey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

const SURVEY_STATUSES: { value: NPSSurveyStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

const STATUS_VARIANT: Record<NPSSurveyStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  active: "default",
  closed: "destructive",
  archived: "secondary",
};

const PAGE_SIZE = 50;

export default function SurveysPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filters, setFilters] = React.useState<NPSSurveyListParams>({});
  const [page, setPage] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newSurvey, setNewSurvey] = React.useState<NPSSurveyCreateData>({
    name: "",
    quarter: Math.ceil((new Date().getMonth() + 1) / 3),
    year: new Date().getFullYear(),
  });

  const queryParams = { ...filters, skip: page * PAGE_SIZE, limit: PAGE_SIZE };
  const { data, isLoading } = useNPSSurveys(queryParams);

  const createMutation = useCreateNPSSurvey();
  const activateMutation = useActivateNPSSurvey();
  const closeMutation = useCloseNPSSurvey();

  const handleCreate = () => {
    if (!newSurvey.name.trim()) {
      toast.error("Survey name is required");
      return;
    }
    createMutation.mutate(newSurvey, {
      onSuccess: () => {
        toast.success("Survey created");
        setDialogOpen(false);
        setNewSurvey({
          name: "",
          quarter: Math.ceil((new Date().getMonth() + 1) / 3),
          year: new Date().getFullYear(),
        });
      },
    });
  };

  const handleActivate = (id: string) => {
    activateMutation.mutate(id, {
      onSuccess: () => toast.success("Survey activated"),
    });
  };

  const handleClose = (id: string) => {
    closeMutation.mutate(id, {
      onSuccess: () => toast.success("Survey closed"),
    });
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

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            NPS Surveys
          </h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Survey</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create NPS Survey</DialogTitle>
                <DialogDescription>
                  Create a new NPS survey for client feedback collection.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="survey-name">Name</Label>
                  <Input
                    id="survey-name"
                    placeholder="Q1 2026 Client Satisfaction"
                    value={newSurvey.name}
                    onChange={(e) =>
                      setNewSurvey((s) => ({ ...s, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="survey-description">Description</Label>
                  <Input
                    id="survey-description"
                    placeholder="Optional description"
                    value={newSurvey.description ?? ""}
                    onChange={(e) =>
                      setNewSurvey((s) => ({
                        ...s,
                        description: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="survey-quarter">Quarter</Label>
                    <Select
                      value={String(newSurvey.quarter)}
                      onValueChange={(v) =>
                        setNewSurvey((s) => ({ ...s, quarter: Number(v) }))
                      }
                    >
                      <SelectTrigger id="survey-quarter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Q1</SelectItem>
                        <SelectItem value="2">Q2</SelectItem>
                        <SelectItem value="3">Q3</SelectItem>
                        <SelectItem value="4">Q4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="survey-year">Year</Label>
                    <Input
                      id="survey-year"
                      type="number"
                      value={newSurvey.year}
                      onChange={(e) =>
                        setNewSurvey((s) => ({
                          ...s,
                          year: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                status: value === "all" ? undefined : (value as NPSSurveyStatus),
              }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {SURVEY_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                quarter: value === "all" ? undefined : Number(value),
              }));
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Quarter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="1">Q1</SelectItem>
              <SelectItem value="2">Q2</SelectItem>
              <SelectItem value="3">Q3</SelectItem>
              <SelectItem value="4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading surveys...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Distribution</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.surveys.map((survey) => (
                  <TableRow
                    key={survey.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/surveys/${survey.id}`)}
                  >
                    <TableCell className="font-medium">
                      {survey.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Q{survey.quarter} {survey.year}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[survey.status]}>
                        {survey.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {survey.distribution_method}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(survey.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="flex gap-2"
                    >
                      {(survey.status === "draft" ||
                        survey.status === "scheduled") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivate(survey.id);
                          }}
                          disabled={activateMutation.isPending}
                        >
                          Activate
                        </Button>
                      )}
                      {survey.status === "active" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClose(survey.id);
                          }}
                          disabled={closeMutation.isPending}
                        >
                          Close
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data?.surveys.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No surveys found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} survey{data?.total !== 1 ? "s" : ""} total
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
    </div>
  );
}

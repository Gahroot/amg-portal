"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  useNPSSurvey,
  useNPSSurveyStats,
  useNPSResponses,
  useNPSFollowUps,
  useActivateNPSSurvey,
  useCloseNPSSurvey,
  useCompleteNPSFollowUp,
} from "@/hooks/use-nps-surveys";
import type {
  NPSScoreCategory,
  NPSResponseListParams,
  NPSFollowUpListParams,
  NPSSurveyStatus,
  NPSFollowUpStatus,
  NPSFollowUpPriority,
} from "@/types/nps-survey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

const STATUS_VARIANT: Record<NPSSurveyStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  active: "default",
  closed: "destructive",
  archived: "secondary",
};

const CATEGORY_VARIANT: Record<NPSScoreCategory, "default" | "secondary" | "destructive"> = {
  promoter: "default",
  passive: "secondary",
  detractor: "destructive",
};

const FOLLOWUP_STATUS_VARIANT: Record<NPSFollowUpStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  acknowledged: "secondary",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

const PRIORITY_VARIANT: Record<NPSFollowUpPriority, "default" | "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

export default function SurveyDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const surveyId = params.id;

  const [responseFilters, setResponseFilters] = React.useState<NPSResponseListParams>({});
  const [followUpFilters, setFollowUpFilters] = React.useState<NPSFollowUpListParams>({});

  const { data: survey, isLoading: surveyLoading } = useNPSSurvey(surveyId);
  const { data: stats, isLoading: statsLoading } = useNPSSurveyStats(surveyId);
  const { data: responsesData } = useNPSResponses(surveyId, responseFilters);
  const { data: followUpsData } = useNPSFollowUps(surveyId, followUpFilters);

  const activateMutation = useActivateNPSSurvey();
  const closeMutation = useCloseNPSSurvey();
  const completeMutation = useCompleteNPSFollowUp();

  const handleActivate = () => {
    activateMutation.mutate(surveyId, {
      onSuccess: () => toast.success("Survey activated"),
    });
  };

  const handleClose = () => {
    closeMutation.mutate(surveyId, {
      onSuccess: () => toast.success("Survey closed"),
    });
  };

  const handleCompleteFollowUp = (followUpId: string) => {
    const notes = prompt("Resolution notes:");
    if (notes !== null) {
      completeMutation.mutate(
        { followUpId, resolutionNotes: notes || undefined },
        { onSuccess: () => toast.success("Follow-up completed") }
      );
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

  if (surveyLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-muted-foreground text-sm">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-muted-foreground">Survey not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/surveys")}
              className="mb-2 -ml-2"
            >
              ← Back to Surveys
            </Button>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {survey.name}
            </h1>
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_VARIANT[survey.status]}>
                {survey.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Q{survey.quarter} {survey.year}
              </span>
              {survey.description && (
                <span className="text-sm text-muted-foreground">
                  — {survey.description}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {(survey.status === "draft" || survey.status === "scheduled") && (
              <Button
                onClick={handleActivate}
                disabled={activateMutation.isPending}
              >
                Activate
              </Button>
            )}
            {survey.status === "active" && (
              <Button
                variant="destructive"
                onClick={handleClose}
                disabled={closeMutation.isPending}
              >
                Close Survey
              </Button>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-sm">NPS Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.nps_score}</p>
                <p className="text-xs text-muted-foreground">
                  Avg: {stats.average_score.toFixed(1)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-sm">Responses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.total_responses}</p>
                <p className="text-xs text-muted-foreground">
                  of {stats.total_sent} sent ({stats.response_rate.toFixed(0)}%)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-sm">Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-700">Promoters</span>
                  <span>
                    {stats.promoters_count} ({stats.promoters_percent.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-yellow-600">Passives</span>
                  <span>
                    {stats.passives_count} ({stats.passives_percent.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-600">Detractors</span>
                  <span>
                    {stats.detractors_count} ({stats.detractors_percent.toFixed(0)}%)
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-sm">Follow-ups</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.follow_ups_pending}</p>
                <p className="text-xs text-muted-foreground">
                  pending · {stats.follow_ups_completed} completed
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="responses">
          <TabsList>
            <TabsTrigger value="responses">
              Responses ({responsesData?.total ?? 0})
            </TabsTrigger>
            <TabsTrigger value="follow-ups">
              Follow-ups ({followUpsData?.total ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="responses" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select
                onValueChange={(value) =>
                  setResponseFilters((f) => ({
                    ...f,
                    score_category:
                      value === "all"
                        ? undefined
                        : (value as NPSScoreCategory),
                  }))
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="promoter">Promoters</SelectItem>
                  <SelectItem value="passive">Passives</SelectItem>
                  <SelectItem value="detractor">Detractors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Responded</TableHead>
                    <TableHead>Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responsesData?.responses.map((resp) => (
                    <TableRow key={resp.id}>
                      <TableCell className="font-bold text-lg">
                        {resp.score}
                      </TableCell>
                      <TableCell>
                        <Badge variant={CATEGORY_VARIANT[resp.score_category]}>
                          {resp.score_category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {resp.comment || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {resp.response_channel}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(resp.responded_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {resp.follow_up_required ? (
                          <Badge
                            variant={
                              resp.follow_up_completed
                                ? "default"
                                : "destructive"
                            }
                          >
                            {resp.follow_up_completed ? "Done" : "Required"}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {responsesData?.responses.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No responses found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="follow-ups" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select
                onValueChange={(value) =>
                  setFollowUpFilters((f) => ({
                    ...f,
                    status:
                      value === "all"
                        ? undefined
                        : (value as NPSFollowUpStatus),
                  }))
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select
                onValueChange={(value) =>
                  setFollowUpFilters((f) => ({
                    ...f,
                    priority:
                      value === "all"
                        ? undefined
                        : (value as NPSFollowUpPriority),
                  }))
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followUpsData?.follow_ups.map((fu) => (
                    <TableRow key={fu.id}>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANT[fu.priority]}>
                          {fu.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {fu.action_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={FOLLOWUP_STATUS_VARIANT[fu.status]}>
                          {fu.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {fu.notes || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fu.due_at
                          ? new Date(fu.due_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {fu.status !== "completed" &&
                          fu.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCompleteFollowUp(fu.id)}
                              disabled={completeMutation.isPending}
                            >
                              Complete
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {followUpsData?.follow_ups.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No follow-ups found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

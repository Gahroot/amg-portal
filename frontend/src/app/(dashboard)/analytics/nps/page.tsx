"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import {
  useNPSSurveys,
  useNPSSurveyStats,
  useNPSTrendAnalysis,
  useNPSResponses,
  useNPSFollowUps,
  useMyNPSFollowUps,
  useCreateNPSSurvey,
  useActivateNPSSurvey,
  useCloseNPSSurvey,
  useAcknowledgeNPSFollowUp,
  useCompleteNPSFollowUp,
} from "@/hooks/use-nps-surveys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import type {
  NPSSurvey,
  NPSSurveyStatus,
  NPSFollowUpStatus,
  NPSFollowUpPriority,
  NPSScoreCategory,
  NPSSurveyCreateData,
} from "@/types/nps-survey";

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["managing_director", "relationship_manager"];

const SURVEY_STATUS_VARIANT: Record<
  NPSSurveyStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  scheduled: "secondary",
  active: "default",
  closed: "outline",
  archived: "outline",
};

const FOLLOW_UP_STATUS_VARIANT: Record<
  NPSFollowUpStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "destructive",
  acknowledged: "secondary",
  in_progress: "default",
  completed: "outline",
  cancelled: "outline",
};

const PRIORITY_VARIANT: Record<
  NPSFollowUpPriority,
  "default" | "secondary" | "destructive" | "outline"
> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

const SCORE_CATEGORY_VARIANT: Record<
  NPSScoreCategory,
  "default" | "secondary" | "destructive" | "outline"
> = {
  promoter: "default",
  passive: "secondary",
  detractor: "destructive",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNPSColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function getTrendIcon(direction: "up" | "down" | "stable"): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

function getTrendColor(direction: "up" | "down" | "stable"): string {
  if (direction === "up") return "text-green-600";
  if (direction === "down") return "text-red-600";
  return "text-muted-foreground";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function truncateId(id: string): string {
  return id.slice(0, 8) + "…";
}

function getCurrentQuarter(): number {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBar({
  label,
  percent,
  colorClass,
}: {
  label: string;
  percent: number;
  colorClass: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${colorClass}`}>
          {percent.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${colorClass.replace("text-", "bg-")}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Create Survey Dialog ─────────────────────────────────────────────────────

interface CreateSurveyDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateSurveyDialog({ open, onClose }: CreateSurveyDialogProps) {
  const createMutation = useCreateNPSSurvey();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [quarter, setQuarter] = React.useState<string>(
    String(getCurrentQuarter())
  );
  const [year, setYear] = React.useState<string>(
    String(new Date().getFullYear())
  );
  const [closesAt, setClosesAt] = React.useState("");
  const [targetClientTypes, setTargetClientTypes] = React.useState("");

  function resetForm() {
    setName("");
    setDescription("");
    setQuarter(String(getCurrentQuarter()));
    setYear(String(new Date().getFullYear()));
    setClosesAt("");
    setTargetClientTypes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Survey name is required");
      return;
    }
    const parsedYear = parseInt(year, 10);
    const parsedQuarter = parseInt(quarter, 10);
    if (isNaN(parsedYear) || isNaN(parsedQuarter)) {
      toast.error("Invalid year or quarter");
      return;
    }

    const payload: NPSSurveyCreateData = {
      name: name.trim(),
      quarter: parsedQuarter,
      year: parsedYear,
    };
    if (description.trim()) payload.description = description.trim();
    if (closesAt) payload.closes_at = new Date(closesAt).toISOString();
    if (targetClientTypes.trim()) {
      payload.target_client_types = targetClientTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    try {
      await createMutation.mutateAsync(payload);
      toast.success("Survey created successfully");
      resetForm();
      onClose();
    } catch {
      // error handled by hook
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create NPS Survey</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="survey-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="survey-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q1 2026 Client Satisfaction Survey"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="survey-desc">Description</Label>
            <Textarea
              id="survey-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="survey-quarter">Quarter</Label>
              <Select value={quarter} onValueChange={setQuarter}>
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
            <div className="space-y-1.5">
              <Label htmlFor="survey-year">Year</Label>
              <Input
                id="survey-year"
                type="number"
                min={2020}
                max={2099}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="survey-closes">Closes At</Label>
            <Input
              id="survey-closes"
              type="date"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="survey-client-types">
              Target Client Types
              <span className="ml-1 text-xs text-muted-foreground">
                (comma-separated)
              </span>
            </Label>
            <Input
              id="survey-client-types"
              value={targetClientTypes}
              onChange={(e) => setTargetClientTypes(e.target.value)}
              placeholder="ultra_hnw, family_office"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Survey"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Complete Follow-Up Dialog ────────────────────────────────────────────────

interface CompleteFollowUpDialogProps {
  followUpId: string | null;
  onClose: () => void;
}

function CompleteFollowUpDialog({
  followUpId,
  onClose,
}: CompleteFollowUpDialogProps) {
  const [notes, setNotes] = React.useState("");
  const completeMutation = useCompleteNPSFollowUp();

  async function handleComplete() {
    if (!followUpId) return;
    try {
      await completeMutation.mutateAsync({
        followUpId,
        resolutionNotes: notes.trim() || undefined,
      });
      toast.success("Follow-up marked as complete");
      setNotes("");
      onClose();
    } catch {
      // error handled by hook
    }
  }

  return (
    <Dialog
      open={!!followUpId}
      onOpenChange={(v) => {
        if (!v) {
          setNotes("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete Follow-Up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="resolution-notes">Resolution Notes</Label>
          <Textarea
            id="resolution-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the resolution…"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={completeMutation.isPending}
          >
            {completeMutation.isPending ? "Saving…" : "Mark Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Survey Stats Panel ───────────────────────────────────────────────────────

function SurveyStatsPanel({ surveyId }: { surveyId: string }) {
  const { data: stats, isLoading } = useNPSSurveyStats(surveyId);

  if (isLoading) {
    return (
      <p className="py-4 text-sm text-muted-foreground">Loading stats…</p>
    );
  }
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            NPS Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${getNPSColor(stats.nps_score)}`}>
            {stats.nps_score}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Responses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.total_responses}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.response_rate.toFixed(0)}% response rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Score Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScoreBar
            label="Promoters"
            percent={stats.promoters_percent}
            colorClass="text-green-600"
          />
          <ScoreBar
            label="Passives"
            percent={stats.passives_percent}
            colorClass="text-amber-600"
          />
          <ScoreBar
            label="Detractors"
            percent={stats.detractors_percent}
            colorClass="text-red-600"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Follow-Ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.follow_ups_pending}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.follow_ups_completed} completed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Surveys Tab ──────────────────────────────────────────────────────────────

interface SurveysTabProps {
  selectedSurveyId: string | null;
  onSelectSurvey: (id: string) => void;
  onCreateClick: () => void;
}

function SurveysTab({
  selectedSurveyId,
  onSelectSurvey,
  onCreateClick,
}: SurveysTabProps) {
  const { data, isLoading } = useNPSSurveys();
  const activateMutation = useActivateNPSSurvey();
  const closeMutation = useCloseNPSSurvey();

  async function handleActivate(survey: NPSSurvey, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await activateMutation.mutateAsync(survey.id);
      toast.success(`"${survey.name}" activated`);
    } catch {
      // handled by hook
    }
  }

  async function handleClose(survey: NPSSurvey, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await closeMutation.mutateAsync(survey.id);
      toast.success(`"${survey.name}" closed`);
    } catch {
      // handled by hook
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">Surveys</h2>
        <Button onClick={onCreateClick} size="sm">
          + Create Survey
        </Button>
      </div>

      {isLoading ? (
        <p className="py-4 text-sm text-muted-foreground">
          Loading surveys…
        </p>
      ) : !data || data.surveys.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No surveys found. Create your first NPS survey.
        </p>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Closes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.surveys.map((survey) => (
                <TableRow
                  key={survey.id}
                  className={`cursor-pointer ${
                    selectedSurveyId === survey.id ? "bg-muted/50" : ""
                  }`}
                  onClick={() => onSelectSurvey(survey.id)}
                >
                  <TableCell className="font-medium">{survey.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    Q{survey.quarter} {survey.year}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SURVEY_STATUS_VARIANT[survey.status]}>
                      {survey.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(survey.closes_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(survey.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(survey.status === "draft" ||
                        survey.status === "scheduled") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activateMutation.isPending}
                          onClick={(e) => handleActivate(survey, e)}
                        >
                          Activate
                        </Button>
                      )}
                      {survey.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={closeMutation.isPending}
                          onClick={(e) => handleClose(survey, e)}
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedSurveyId && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg font-semibold">Survey Stats</h3>
          <SurveyStatsPanel surveyId={selectedSurveyId} />
        </div>
      )}
    </div>
  );
}

// ─── Responses Tab ────────────────────────────────────────────────────────────

interface ResponsesTabProps {
  surveys: NPSSurvey[];
  selectedSurveyId: string | null;
  onSelectSurvey: (id: string) => void;
}

function ResponsesTab({
  surveys,
  selectedSurveyId,
  onSelectSurvey,
}: ResponsesTabProps) {
  const { data, isLoading } = useNPSResponses(selectedSurveyId ?? "");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="font-serif text-xl font-semibold">Responses</h2>
        <div className="w-72">
          <Select
            value={selectedSurveyId ?? ""}
            onValueChange={onSelectSurvey}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a survey…" />
            </SelectTrigger>
            <SelectContent>
              {surveys.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} (Q{s.quarter} {s.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedSurveyId ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Select a survey to view its responses.
        </p>
      ) : isLoading ? (
        <p className="py-4 text-sm text-muted-foreground">
          Loading responses…
        </p>
      ) : !data || data.responses.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No responses yet for this survey.
        </p>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client ID</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Responded</TableHead>
                <TableHead>Follow-Up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.responses.map((r) => (
                <TableRow key={r.id}>
                  <TableCell
                    className="font-mono text-xs text-muted-foreground"
                    title={r.client_profile_id}
                  >
                    {truncateId(r.client_profile_id)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-lg font-bold ${
                        r.score >= 9
                          ? "text-green-600"
                          : r.score >= 7
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {r.score}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      /10
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={SCORE_CATEGORY_VARIANT[r.score_category]}
                    >
                      {r.score_category}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-xs truncate text-sm"
                    title={r.comment ?? ""}
                  >
                    {r.comment ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">
                    {r.response_channel}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(r.responded_at)}
                  </TableCell>
                  <TableCell>
                    {r.follow_up_required ? (
                      <Badge
                        variant={
                          r.follow_up_completed ? "outline" : "destructive"
                        }
                      >
                        {r.follow_up_completed ? "done" : "pending"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Follow-Ups Tab ───────────────────────────────────────────────────────────

interface FollowUpsTabProps {
  surveys: NPSSurvey[];
  selectedSurveyId: string | null;
  onSelectSurvey: (id: string) => void;
}

function FollowUpsTab({
  surveys,
  selectedSurveyId,
  onSelectSurvey,
}: FollowUpsTabProps) {
  const [completeId, setCompleteId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("pending");

  const { data: surveyFollowUps, isLoading: surveyLoading } = useNPSFollowUps(
    selectedSurveyId ?? "",
    { status: (statusFilter as NPSFollowUpStatus) || undefined }
  );
  const { data: myFollowUps, isLoading: myLoading } = useMyNPSFollowUps({
    status: "pending",
  });

  const acknowledgeFollowUp = useAcknowledgeNPSFollowUp();

  async function handleAcknowledge(id: string) {
    try {
      await acknowledgeFollowUp.mutateAsync(id);
      toast.success("Follow-up acknowledged");
    } catch {
      // handled by hook
    }
  }

  const isLoading = selectedSurveyId ? surveyLoading : myLoading;
  const followUps = selectedSurveyId
    ? surveyFollowUps?.follow_ups
    : myFollowUps?.follow_ups;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="font-serif text-xl font-semibold">Follow-Up Queue</h2>
        <div className="w-64">
          <Select
            value={selectedSurveyId ?? "__all__"}
            onValueChange={(v) => {
              if (v !== "__all__") onSelectSurvey(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="My follow-ups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">My follow-ups</SelectItem>
              {surveys.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedSurveyId && (
          <div className="w-40">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="py-4 text-sm text-muted-foreground">
          Loading follow-ups…
        </p>
      ) : !followUps || followUps.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No follow-ups found.
        </p>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>Action Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {followUps.map((fu) => (
                <TableRow key={fu.id}>
                  <TableCell>
                    <Badge variant={PRIORITY_VARIANT[fu.priority]}>
                      {fu.priority}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="font-mono text-xs text-muted-foreground"
                    title={fu.client_profile_id}
                  >
                    {truncateId(fu.client_profile_id)}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {fu.action_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={FOLLOW_UP_STATUS_VARIANT[fu.status]}>
                      {fu.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="font-mono text-xs text-muted-foreground"
                    title={fu.assigned_to}
                  >
                    {truncateId(fu.assigned_to)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(fu.due_at)}
                  </TableCell>
                  <TableCell
                    className="max-w-xs truncate text-sm"
                    title={fu.notes ?? ""}
                  >
                    {fu.notes ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {fu.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={acknowledgeFollowUp.isPending}
                          onClick={() => handleAcknowledge(fu.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {fu.status !== "completed" &&
                        fu.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCompleteId(fu.id)}
                          >
                            Complete
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CompleteFollowUpDialog
        followUpId={completeId}
        onClose={() => setCompleteId(null)}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NPSSurveysPage() {
  const { user } = useAuth();
  const [selectedSurveyId, setSelectedSurveyId] = React.useState<
    string | null
  >(null);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("surveys");

  const { data: surveysData } = useNPSSurveys();
  const { data: trends, isLoading: trendsLoading } = useNPSTrendAnalysis({
    quarters: 8,
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

  const surveys = surveysData?.surveys ?? [];

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Client Satisfaction (NPS)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Target: NPS score &gt; 70
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              + Create Survey
            </Button>
            <Link href="/analytics">
              <Button variant="outline" size="sm">
                Back to Analytics
              </Button>
            </Link>
          </div>
        </div>

        {/* Global NPS Overview Cards */}
        {trendsLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading NPS overview…
          </p>
        ) : trends ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Current NPS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-3xl font-bold ${getNPSColor(trends.current_nps)}`}
                >
                  {trends.current_nps}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Target: 70+
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-3xl font-bold ${getTrendColor(trends.trend_direction)}`}
                >
                  {getTrendIcon(trends.trend_direction)}{" "}
                  {trends.change !== null
                    ? `${trends.change > 0 ? "+" : ""}${trends.change}`
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  vs previous period
                  {trends.previous_nps !== null
                    ? ` (${trends.previous_nps})`
                    : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Surveys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{surveys.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {surveys.filter((s) => s.status === "active").length} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Data Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {trends.trends.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  quarters tracked
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* NPS Trend Table */}
        {trends && trends.trends.length > 0 && (
          <div>
            <h2 className="mb-3 font-serif text-xl font-semibold">
              NPS Trend History
            </h2>
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">NPS Score</TableHead>
                    <TableHead className="text-right">Responses</TableHead>
                    <TableHead className="text-right">Promoters %</TableHead>
                    <TableHead className="text-right">Passives %</TableHead>
                    <TableHead className="text-right">Detractors %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trends.trends.map((t) => (
                    <TableRow key={t.period}>
                      <TableCell className="font-medium">
                        {t.period}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-bold ${getNPSColor(t.nps_score)}`}
                        >
                          {t.nps_score}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {t.response_count}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {t.promoters_percent.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {t.passives_percent.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {t.detractors_percent.toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="surveys">Surveys</TabsTrigger>
            <TabsTrigger value="responses">Responses</TabsTrigger>
            <TabsTrigger value="follow-ups">Follow-Ups</TabsTrigger>
          </TabsList>

          <TabsContent value="surveys" className="mt-4">
            <SurveysTab
              selectedSurveyId={selectedSurveyId}
              onSelectSurvey={(id) => {
                setSelectedSurveyId((prev) => (prev === id ? null : id));
              }}
              onCreateClick={() => setShowCreateDialog(true)}
            />
          </TabsContent>

          <TabsContent value="responses" className="mt-4">
            <ResponsesTab
              surveys={surveys}
              selectedSurveyId={selectedSurveyId}
              onSelectSurvey={setSelectedSurveyId}
            />
          </TabsContent>

          <TabsContent value="follow-ups" className="mt-4">
            <FollowUpsTab
              surveys={surveys}
              selectedSurveyId={selectedSurveyId}
              onSelectSurvey={setSelectedSurveyId}
            />
          </TabsContent>
        </Tabs>
      </div>

      <CreateSurveyDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import {
  useNPSSurveys,
  useNPSTrendAnalysis,
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
  NPSSurveyCreateData,
} from "@/types/nps-survey";
import {
  isNPSFollowUpPriority,
  isNPSFollowUpStatus,
} from "@/lib/type-guards";
import { NPSChart } from "./_components/nps-chart";
import { SentimentAnalysis } from "./_components/sentiment-analysis";
import { SurveyComments } from "./_components/survey-comments";

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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Create Survey Dialog ─────────────────────────────────────────────────────

interface CreateSurveyDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateSurveyDialog({ open, onClose }: CreateSurveyDialogProps) {
  const createMutation = useCreateNPSSurvey();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quarter, setQuarter] = useState<string>(
    String(getCurrentQuarter())
  );
  const [year, setYear] = useState<string>(
    String(new Date().getFullYear())
  );
  const [closesAt, setClosesAt] = useState("");
  const [targetClientTypes, setTargetClientTypes] = useState("");

  function resetForm() {
    setName("");
    setDescription("");
    setQuarter(String(getCurrentQuarter()));
    setYear(String(new Date().getFullYear()));
    setClosesAt("");
    setTargetClientTypes("");
  }

  async function handleSubmit(e: FormEvent) {
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
      distribution_method: "email",
      reminder_enabled: true,
      reminder_days: 7,
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
  const [notes, setNotes] = useState("");
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

  async function handleActivate(survey: NPSSurvey, e: MouseEvent) {
    e.stopPropagation();
    try {
      await activateMutation.mutateAsync(survey.id);
      toast.success(`"${survey.name}" activated`);
    } catch {
      // handled by hook
    }
  }

  async function handleClose(survey: NPSSurvey, e: MouseEvent) {
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
        <div className="rounded-md border bg-card">
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
                    <Badge variant={SURVEY_STATUS_VARIANT[survey.status as NPSSurveyStatus]}>
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
          <SentimentAnalysis surveyId={selectedSurveyId} />
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
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

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
        <div className="rounded-md border bg-card">
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
                    <Badge
                      variant={
                        isNPSFollowUpPriority(fu.priority)
                          ? PRIORITY_VARIANT[fu.priority]
                          : "secondary"
                      }
                    >
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
                    <Badge
                      variant={
                        isNPSFollowUpStatus(fu.status)
                          ? FOLLOW_UP_STATUS_VARIANT[fu.status]
                          : "secondary"
                      }
                    >
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
  const [selectedSurveyId, setSelectedSurveyId] = useState<
    string | null
  >(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("surveys");

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
    <div className="min-h-screen bg-background p-8">
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

        {/* Global NPS Overview + Trend History */}
        {trendsLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading NPS overview…
          </p>
        ) : trends ? (
          <NPSChart
            trends={trends}
            totalSurveys={surveys.length}
            activeSurveys={surveys.filter((s) => s.status === "active").length}
          />
        ) : null}

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
            <SurveyComments
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

"use client";

import { useState } from "react";
import { BarChart2, ChevronRight, Plus, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  useActivatePulseSurvey,
  useClosePulseSurvey,
  useCreatePulseSurvey,
  usePulseSurveyResponses,
  usePulseSurveys,
  usePulseSurveyStats,
} from "@/hooks/use-pulse-surveys";
import type {
  PulseSurvey,
  PulseSurveyCreateData,
  PulseSurveyResponseType,
  PulseSurveyStatus,
  PulseSurveyTrigger,
} from "@/types/pulse-survey";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<
  PulseSurveyStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  active: "default",
  closed: "outline",
};

const RESPONSE_TYPE_LABELS: Record<PulseSurveyResponseType, string> = {
  emoji: "Emoji (😊 😐 😞)",
  stars: "Stars (1–5)",
  yes_no: "Yes / No",
  thumbs: "Thumbs (👍 👎)",
};

const TRIGGER_LABELS: Record<PulseSurveyTrigger, string> = {
  document_delivery: "After document delivery",
  milestone_completion: "After milestone completion",
  random: "Random sampling",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sentimentLabel(score: number | null): string {
  if (score === null) return "—";
  const pct = Math.round(score * 100);
  if (pct >= 70) return `${pct}% positive ✓`;
  if (pct >= 40) return `${pct}% positive`;
  return `${pct}% positive ↓`;
}

function sentimentColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 0.7) return "text-green-600 dark:text-green-400";
  if (score >= 0.4) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// ─── Survey Stats Panel ───────────────────────────────────────────────────────

function SurveyStatsPanel({ survey }: { survey: PulseSurvey }) {
  const { data: stats, isLoading } = usePulseSurveyStats(survey.id);
  const { data: responsesData } = usePulseSurveyResponses(survey.id, { limit: 50 });

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 flex-1 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-muted/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Responses</p>
            <p className="mt-1 font-serif text-3xl font-bold">{stats.total_responses}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">With Comments</p>
            <p className="mt-1 font-serif text-3xl font-bold">{stats.has_comments}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Sentiment</p>
            <p className={`mt-1 text-base font-semibold ${sentimentColor(stats.sentiment_score)}`}>
              {sentimentLabel(stats.sentiment_score)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      {stats.breakdown.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-medium">Response Breakdown</p>
          <div className="space-y-2">
            {stats.breakdown.map((item) => (
              <div key={item.value} className="flex items-center gap-3">
                <span className="w-16 text-right text-sm font-medium capitalize">
                  {item.value}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-muted h-4">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <span className="w-20 text-right text-sm text-muted-foreground">
                  {item.count} ({item.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent comments */}
      {responsesData && responsesData.responses.some((r) => r.comment) && (
        <div>
          <p className="mb-3 text-sm font-medium">Recent Comments</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {responsesData.responses
              .filter((r) => r.comment)
              .slice(0, 10)
              .map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                >
                  <p className="text-muted-foreground leading-relaxed">{r.comment}</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    {new Date(r.responded_at).toLocaleString()} · {r.response_value}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateSurveyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createMutation = useCreatePulseSurvey();
  const [form, setForm] = useState<PulseSurveyCreateData>({
    title: "",
    question: "",
    response_type: "thumbs",
    allow_comment: true,
    trigger_type: "random",
    min_days_between_shows: 14,
  });

  const handleSubmit = () => {
    if (!form.title || !form.question) return;
    createMutation.mutate(form, {
      onSuccess: () => {
        onClose();
        setForm({
          title: "",
          question: "",
          response_type: "thumbs",
          allow_comment: true,
          trigger_type: "random",
          min_days_between_shows: 14,
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">New Pulse Survey</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ps-title">Title</Label>
            <Input
              id="ps-title"
              placeholder="e.g. How was your document delivery?"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-question">Question</Label>
            <Textarea
              id="ps-question"
              placeholder="The question clients will see…"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Response Type</Label>
              <Select
                value={form.response_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, response_type: v as PulseSurveyResponseType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESPONSE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <Select
                value={form.trigger_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, trigger_type: v as PulseSurveyTrigger }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-min-days">
              Minimum days between surveys (anti-fatigue)
            </Label>
            <Input
              id="ps-min-days"
              type="number"
              min={1}
              max={365}
              value={form.min_days_between_shows}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  min_days_between_shows: parseInt(e.target.value, 10) || 14,
                }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.title || !form.question || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating…" : "Create Survey"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PulseSurveyAdminPage() {
  const [tab, setTab] = useState<PulseSurveyStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = usePulseSurveys(
    tab === "all" ? undefined : { status: tab }
  );
  const activateMutation = useActivatePulseSurvey();
  const closeMutation = useClosePulseSurvey();

  const selected = data?.surveys.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">Pulse Surveys</h1>
            <p className="text-sm text-muted-foreground">
              One-click satisfaction checks between quarterly NPS surveys
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Survey
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Survey list */}
        <div className="flex-1 min-w-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : !data?.surveys.length ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <BarChart2 className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No surveys yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                  >
                    Create your first pulse survey
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Responses</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.surveys.map((survey) => (
                      <TableRow
                        key={survey.id}
                        className={`cursor-pointer transition-colors ${
                          selectedId === survey.id ? "bg-muted/60" : "hover:bg-muted/30"
                        }`}
                        onClick={() =>
                          setSelectedId(selectedId === survey.id ? null : survey.id)
                        }
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {survey.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {RESPONSE_TYPE_LABELS[survey.response_type as PulseSurveyResponseType]}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {TRIGGER_LABELS[survey.trigger_type as PulseSurveyTrigger]}
                        </TableCell>
                        <TableCell>{survey.response_count}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[survey.status as PulseSurveyStatus]} className="capitalize">
                            {survey.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(survey.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {survey.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  activateMutation.mutate(survey.id);
                                }}
                                disabled={activateMutation.isPending}
                              >
                                Activate
                              </Button>
                            )}
                            {survey.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeMutation.mutate(survey.id);
                                }}
                                disabled={closeMutation.isPending}
                              >
                                Close
                              </Button>
                            )}
                            <ChevronRight
                              className={`h-4 w-4 text-muted-foreground transition-transform ${
                                selectedId === survey.id ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Stats panel */}
        {selected && (
          <div className="w-[400px] shrink-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-base">{selected.title}</CardTitle>
                <CardDescription className="text-xs">
                  {selected.question}
                </CardDescription>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant={STATUS_VARIANT[selected.status as PulseSurveyStatus]} className="capitalize">
                    {selected.status}
                  </Badge>
                  <Badge variant="outline">
                    {RESPONSE_TYPE_LABELS[selected.response_type as PulseSurveyResponseType]}
                  </Badge>
                  <Badge variant="outline">
                    {TRIGGER_LABELS[selected.trigger_type as PulseSurveyTrigger]}
                  </Badge>
                </div>
                {(selected.active_from || selected.active_to) && (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(selected.active_from)} → {formatDate(selected.active_to)}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <SurveyStatsPanel survey={selected} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <CreateSurveyDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

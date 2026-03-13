"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Clock,
  User,
  FileText,
  Award,
  Shield,
  Save,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  type PartnerOnboarding,
  type OnboardingStage,
  ONBOARDING_STAGES,
  DEFAULT_CHECKLIST_ITEMS,
} from "@/types/partner-capability";
import {
  getPartnerOnboarding,
  completeOnboardingStage,
  updateOnboarding,
} from "@/lib/api/partner-capabilities";
import { usePartnerProfile } from "@/hooks/use-partner-portal";

const STAGE_ICONS: Record<OnboardingStage, React.ReactNode> = {
  profile_setup: <User className="h-5 w-5" />,
  capability_matrix: <Award className="h-5 w-5" />,
  compliance_docs: <Shield className="h-5 w-5" />,
  certification_upload: <FileText className="h-5 w-5" />,
  review: <Clock className="h-5 w-5" />,
  completed: <Check className="h-5 w-5" />,
};

const STAGE_ACTION_LINKS: Partial<
  Record<OnboardingStage, { href: string; label: string }>
> = {
  profile_setup: { href: "/partner/settings", label: "Edit Profile" },
  capability_matrix: {
    href: "/partner/settings",
    label: "Manage Capabilities",
  },
  compliance_docs: { href: "/partner/documents", label: "Upload Documents" },
  certification_upload: {
    href: "/partner/documents",
    label: "Add Certifications",
  },
};

/** Actionable stages the partner can work through (excludes review & completed) */
const ACTIONABLE_STAGES = ONBOARDING_STAGES.filter(
  (s) => s.id !== "completed"
);

export default function PartnerOnboardingPage() {
  const { data: profile, isLoading: profileLoading } = usePartnerProfile();
  const [onboarding, setOnboarding] =
    React.useState<PartnerOnboarding | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Load onboarding data once profile is available
  React.useEffect(() => {
    if (profileLoading || !profile) return;
    loadOnboarding(profile.id);
  }, [profileLoading, profile]);

  const loadOnboarding = async (partnerId: string) => {
    try {
      const data = await getPartnerOnboarding(partnerId);
      setOnboarding(data as PartnerOnboarding | null);
    } catch {
      console.error("Failed to load onboarding");
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Checklist toggle ----
  const handleChecklistItemToggle = async (
    stage: OnboardingStage,
    item: string,
    checked: boolean
  ) => {
    if (!onboarding || !profile) return;

    setIsSaving(true);
    try {
      const currentChecklist = onboarding.checklist_items || {};
      const stageChecklist = currentChecklist[stage] || {};
      const updatedChecklist = {
        ...currentChecklist,
        [stage]: { ...stageChecklist, [item]: checked },
      };

      // Persist checklist via partial update
      const updated = await updateOnboarding(profile.id, {
        checklist_items: updatedChecklist,
      });
      setOnboarding(updated);

      // Auto-complete stage when every item is checked
      const stageItems = DEFAULT_CHECKLIST_ITEMS[stage];
      const allDone = Object.keys(stageItems).every(
        (key) => updatedChecklist[stage]?.[key] === true
      );
      if (allDone && !updated.completed_stages.includes(stage)) {
        const completed = await completeOnboardingStage(profile.id, {
          stage,
          checklist_items: updatedChecklist[stage],
        });
        setOnboarding(completed);
        toast.success(
          `${ONBOARDING_STAGES.find((s) => s.id === stage)?.label} completed!`
        );
      }
    } catch {
      toast.error("Failed to save progress");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Save & continue later ----
  const handleSave = async () => {
    if (!onboarding || !profile) return;
    setIsSaving(true);
    try {
      await updateOnboarding(profile.id, {
        checklist_items: onboarding.checklist_items,
      });
      toast.success("Progress saved — you can continue later");
    } catch {
      toast.error("Failed to save progress");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Submit for review ----
  const handleSubmitForReview = async () => {
    if (!onboarding || !profile) return;
    setIsSubmitting(true);
    try {
      const updated = await completeOnboardingStage(profile.id, {
        stage: "review",
        checklist_items: { review_submitted: true },
      });
      setOnboarding(updated);
      toast.success("Onboarding submitted for coordinator review");
    } catch {
      toast.error("Failed to submit for review");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Loading states ----
  if (isLoading || profileLoading) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Onboarding has not been started for your account.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact your coordinator to begin the onboarding process.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isReviewStage = onboarding.current_stage === "review";
  const isCompleted = onboarding.current_stage === "completed";

  // Determine which prerequisite stages must be finished before review
  const preReviewStages = ACTIONABLE_STAGES.filter(
    (s) => s.id !== "review" && s.id !== "completed"
  );
  const allPreReviewDone = preReviewStages.every((s) =>
    onboarding.completed_stages.includes(s.id)
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Partner Onboarding
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete the following steps to activate your partner account
          </p>
        </div>
        {!isCompleted && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save Progress
          </Button>
        )}
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Progress</CardTitle>
            <span className="text-sm text-muted-foreground">
              {onboarding.progress_percentage}% Complete
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={onboarding.progress_percentage} className="h-2" />
          {onboarding.coordinator_name && (
            <p className="text-sm text-muted-foreground mt-2">
              Assigned Coordinator: {onboarding.coordinator_name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stage Progress Indicator */}
      <div className="flex items-center justify-between">
        {ACTIONABLE_STAGES.map((stage, index) => {
          const stageCompleted = onboarding.completed_stages.includes(stage.id);
          const isCurrent = stage.id === onboarding.current_stage;

          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    stageCompleted
                      ? "bg-green-100 text-green-600"
                      : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {stageCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    STAGE_ICONS[stage.id]
                  )}
                </div>
                <span
                  className={`text-xs mt-1 text-center max-w-[80px] ${
                    isCurrent ? "font-medium" : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {index < ACTIONABLE_STAGES.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stage Cards — show all actionable stages as expandable sections */}
      {!isCompleted &&
        ACTIONABLE_STAGES.map((stage) => {
          const stageCompleted = onboarding.completed_stages.includes(stage.id);
          const isCurrent = stage.id === onboarding.current_stage;
          const checklistEntries = Object.entries(
            DEFAULT_CHECKLIST_ITEMS[stage.id] || {}
          );
          const checkedCount = checklistEntries.filter(
            ([key]) =>
              onboarding.checklist_items?.[stage.id]?.[key] === true
          ).length;
          const actionLink = STAGE_ACTION_LINKS[stage.id];

          // Review stage shown separately below
          if (stage.id === "review") return null;

          return (
            <Card
              key={stage.id}
              className={
                isCurrent
                  ? "border-primary/50"
                  : stageCompleted
                    ? "border-green-200 bg-green-50/30"
                    : "opacity-70"
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        stageCompleted
                          ? "bg-green-100 text-green-600"
                          : isCurrent
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {stageCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        STAGE_ICONS[stage.id]
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{stage.label}</CardTitle>
                      <CardDescription className="text-xs">
                        {stage.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      stageCompleted
                        ? "default"
                        : isCurrent
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {stageCompleted
                      ? "Complete"
                      : isCurrent
                        ? `${checkedCount}/${checklistEntries.length}`
                        : "Pending"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {checklistEntries.map(([key, label]) => {
                    const isChecked =
                      onboarding.checklist_items?.[stage.id]?.[key] === true;
                    const disabled = stageCompleted || isSaving;

                    return (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${stage.id}-${key}`}
                          checked={isChecked}
                          disabled={disabled}
                          onCheckedChange={(checked) =>
                            handleChecklistItemToggle(
                              stage.id,
                              key,
                              checked as boolean
                            )
                          }
                        />
                        <label
                          htmlFor={`${stage.id}-${key}`}
                          className={`text-sm ${disabled ? "text-muted-foreground" : ""}`}
                        >
                          {label}
                        </label>
                      </div>
                    );
                  })}
                </div>

                {/* Action link for the stage */}
                {actionLink && !stageCompleted && (
                  <div className="mt-4">
                    <Button asChild size="sm">
                      <Link href={actionLink.href}>{actionLink.label}</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

      {/* Review / Submit Stage */}
      {!isCompleted && (
        <Card
          className={
            isReviewStage
              ? "border-primary/50"
              : allPreReviewDone
                ? "border-amber-200 bg-amber-50/30"
                : "opacity-70"
          }
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isReviewStage
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Review &amp; Approval
                </CardTitle>
                <CardDescription className="text-xs">
                  Submit your completed onboarding for coordinator review
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!allPreReviewDone ? (
              <p className="text-sm text-muted-foreground">
                Complete all previous steps before submitting for review.
              </p>
            ) : isReviewStage ? (
              <div className="space-y-4">
                <Badge variant="outline" className="py-2 px-4">
                  Awaiting Coordinator Review
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Your onboarding has been submitted. A coordinator will review
                  your profile, documents, and certifications.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm">
                  All stages are complete. Submit your onboarding for final
                  review by your assigned coordinator.
                </p>
                <Button
                  onClick={handleSubmitForReview}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-4 w-4" />
                  )}
                  Submit for Review
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed State */}
      {isCompleted && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Onboarding Complete!
            </h2>
            <p className="text-muted-foreground mb-4">
              Your partner account is now fully activated.
            </p>
            <Button asChild>
              <Link href="/partner">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Completed Stages Summary (when still in progress) */}
      {onboarding.completed_stages.length > 0 && !isCompleted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completed Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {onboarding.completed_stages.map((stageId) => {
                const stage = ONBOARDING_STAGES.find((s) => s.id === stageId);
                if (!stage) return null;

                return (
                  <div
                    key={stageId}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{stage.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

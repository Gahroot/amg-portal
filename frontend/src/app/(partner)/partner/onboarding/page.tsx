"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Clock, User, FileText, Award, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  type PartnerOnboarding,
  type OnboardingStage,
  ONBOARDING_STAGES,
  DEFAULT_CHECKLIST_ITEMS,
} from "@/types/partner-capability";
import { getPartnerOnboarding, completeOnboardingStage } from "@/lib/api/partner-capabilities";

// Stage icons
const STAGE_ICONS: Record<OnboardingStage, React.ReactNode> = {
  profile_setup: <User className="h-5 w-5" />,
  capability_matrix: <Award className="h-5 w-5" />,
  compliance_docs: <Shield className="h-5 w-5" />,
  certification_upload: <FileText className="h-5 w-5" />,
  review: <Clock className="h-5 w-5" />,
  completed: <Check className="h-5 w-5" />,
};

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const [onboarding, setOnboarding] = React.useState<PartnerOnboarding | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    loadOnboarding();
  }, []);

  const loadOnboarding = async () => {
    try {
      // Get partner ID from the current user's profile
      const profileResponse = await fetch("/api/v1/partner-portal/profile");
      if (!profileResponse.ok) {
        router.push("/login");
        return;
      }
      const profile = await profileResponse.json();

      const data = await getPartnerOnboarding(profile.id);
      setOnboarding(data);
    } catch {
      toast.error("Failed to load onboarding");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChecklistItemToggle = async (stage: OnboardingStage, item: string, checked: boolean) => {
    if (!onboarding || !profile) return;

    setIsSaving(true);
    try {
      const currentChecklist = onboarding.checklist_items || {};
      const stageChecklist = currentChecklist[stage] || {};
      const updatedChecklist = {
        ...currentChecklist,
        [stage]: {
          ...stageChecklist,
          [item]: checked,
        },
      };

      // Check if all items in the stage are complete
      const stageItems = DEFAULT_CHECKLIST_ITEMS[stage];
      const allItemsComplete = Object.keys(stageItems).every(
        (key) => updatedChecklist[stage]?.[key] === true
      );

      if (allItemsComplete && !onboarding.completed_stages.includes(stage)) {
        // Complete the stage
        const updated = await completeOnboardingStage(profile.id, {
          stage,
          checklist_items: updatedChecklist[stage],
        });
        setOnboarding(updated);
      } else {
        // Just update the checklist locally for now
        setOnboarding({
          ...onboarding,
          checklist_items: updatedChecklist,
        });
      }
    } catch {
      toast.error("Failed to update checklist");
    } finally {
      setIsSaving(false);
    }
  };

  const [profile, setProfile] = React.useState<{ id: string } | null>(null);

  React.useEffect(() => {
    fetch("/api/v1/partner-portal/profile")
      .then((res) => res.json())
      .then(setProfile)
      .catch(() => {
        // Profile fetch is non-critical; error is handled elsewhere
      });
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <p className="text-muted-foreground">Loading...</p>
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

  const currentStageIndex = ONBOARDING_STAGES.findIndex(
    (s) => s.id === onboarding.current_stage
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Partner Onboarding
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete the following steps to activate your partner account
        </p>
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

      {/* Stage Progress */}
      <div className="flex items-center justify-between mb-6">
        {ONBOARDING_STAGES.map((stage, index) => {
          const isCompleted = onboarding.completed_stages.includes(stage.id);
          const isCurrent = stage.id === onboarding.current_stage;
          const isUpcoming = index > currentStageIndex;

          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                      : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
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
              {index < ONBOARDING_STAGES.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current Stage Details */}
      {onboarding.current_stage !== "completed" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {
                ONBOARDING_STAGES.find((s) => s.id === onboarding.current_stage)
                  ?.label
              }
            </CardTitle>
            <CardDescription>
              {
                ONBOARDING_STAGES.find((s) => s.id === onboarding.current_stage)
                  ?.description
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Checklist</h4>
              {Object.entries(DEFAULT_CHECKLIST_ITEMS[onboarding.current_stage] || {}).map(
                ([key, label]) => {
                  const isChecked =
                    onboarding.checklist_items?.[onboarding.current_stage]?.[key] === true;
                  const isDisabled = onboarding.current_stage === "review";

                  return (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={isChecked}
                        disabled={isDisabled || isSaving}
                        onCheckedChange={(checked) =>
                          handleChecklistItemToggle(
                            onboarding.current_stage,
                            key,
                            checked as boolean
                          )
                        }
                      />
                      <label
                        htmlFor={key}
                        className={`text-sm ${isDisabled ? "text-muted-foreground" : ""}`}
                      >
                        {label}
                      </label>
                    </div>
                  );
                }
              )}
            </div>

            {/* Action buttons based on stage */}
            <div className="mt-6 flex gap-3">
              {onboarding.current_stage === "profile_setup" && (
                <Button asChild>
                  <Link href="/partner">Edit Profile</Link>
                </Button>
              )}
              {onboarding.current_stage === "capability_matrix" && (
                <Button asChild>
                  <Link href="/partner/capabilities">Manage Capabilities</Link>
                </Button>
              )}
              {onboarding.current_stage === "compliance_docs" && (
                <Button asChild>
                  <Link href="/partner/documents">Upload Documents</Link>
                </Button>
              )}
              {onboarding.current_stage === "certification_upload" && (
                <Button asChild>
                  <Link href="/partner/certifications">Add Certifications</Link>
                </Button>
              )}
              {onboarding.current_stage === "review" && (
                <Badge variant="outline" className="py-2 px-4">
                  Awaiting Coordinator Review
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed State */}
      {onboarding.current_stage === "completed" && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Onboarding Complete!</h2>
            <p className="text-muted-foreground mb-4">
              Your partner account is now fully activated.
            </p>
            <Button asChild>
              <Link href="/partner">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Completed Stages Summary */}
      {onboarding.completed_stages.length > 0 && onboarding.current_stage !== "completed" && (
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
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
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

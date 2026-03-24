"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/auth-provider";
import { useSubmitIntake } from "@/hooks/use-intake";
import { intakeFormSchema, type IntakeFormData } from "@/lib/validations/client";
import { checkClientDuplicates } from "@/lib/api/clients";
import type { DuplicateMatch } from "@/types/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DuplicateWarningDialog } from "@/components/clients/duplicate-warning-dialog";
import { IntakeStepIdentity } from "./intake-step-identity";
import { IntakeStepContact } from "./intake-step-contact";
import { IntakeStepPreferences } from "./intake-step-preferences";
import { IntakeStepLifestyle } from "./intake-step-lifestyle";
import { IntakeStepFamily } from "./intake-step-family";

const ALLOWED_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

const STEPS = [
  { id: 1, title: "Identity", description: "Basic information" },
  { id: 2, title: "Contact", description: "Contact details" },
  { id: 3, title: "Preferences", description: "Communication preferences" },
  { id: 4, title: "Lifestyle", description: "Travel and lifestyle" },
  { id: 5, title: "Family", description: "Family members" },
];

/** Steps at which a duplicate check should fire before advancing. */
const DUPLICATE_CHECK_STEPS = new Set([1, 2]);

interface IntakeWizardProps {
  initialData?: Partial<IntakeFormData>;
  profileId?: string;
  isEditing?: boolean;
}

export function IntakeWizard({
  initialData,
  profileId,
  isEditing = false,
}: IntakeWizardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[]>([]);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = React.useState(false);
  const [pendingNextStep, setPendingNextStep] = React.useState<number | null>(null);
  const submitMutation = useSubmitIntake();

  const methods = useForm<IntakeFormData>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      legal_name: "",
      primary_email: "",
      preferred_destinations: [],
      ...initialData,
    },
    mode: "onChange",
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

  const progress = (currentStep / STEPS.length) * 100;

  /**
   * Run a duplicate check for the fields captured so far.
   * Only runs when advancing from steps 1 or 2 (where name/email/phone are entered).
   * Returns the list of matches found (empty array = no duplicates).
   */
  const runDuplicateCheck = async (): Promise<DuplicateMatch[]> => {
    if (!DUPLICATE_CHECK_STEPS.has(currentStep) || isEditing) return [];

    const values = methods.getValues();
    const hasEnoughData =
      (values.legal_name && values.legal_name.trim().length >= 3) ||
      (values.primary_email && values.primary_email.trim().length > 0) ||
      (values.phone && values.phone.trim().length >= 7);

    if (!hasEnoughData) return [];

    try {
      const matches = await checkClientDuplicates({
        legal_name: values.legal_name || null,
        primary_email: values.primary_email || null,
        phone: values.phone || null,
      });
      return matches;
    } catch {
      // Non-blocking — if the check fails, don't block the user
      return [];
    }
  };

  const handleNext = async () => {
    // Validate current step fields
    let fieldsToValidate: (keyof IntakeFormData)[] = [];

    switch (currentStep) {
      case 1:
        fieldsToValidate = ["legal_name"];
        break;
      case 2:
        fieldsToValidate = ["primary_email"];
        break;
      default:
        break;
    }

    const isValid = await methods.trigger(fieldsToValidate);
    if (!isValid) return;

    const nextStep = currentStep + 1;
    if (nextStep > STEPS.length) return;

    // Run duplicate check before advancing from identity / contact steps
    const matches = await runDuplicateCheck();
    if (matches.length > 0) {
      setDuplicates(matches);
      setPendingNextStep(nextStep);
      setDuplicateDialogOpen(true);
      return;
    }

    setCurrentStep(nextStep);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  /** User confirmed they want to proceed despite duplicates. */
  const handleCreateAnyway = () => {
    if (pendingNextStep !== null) {
      setCurrentStep(pendingNextStep);
      setPendingNextStep(null);
    }
    setDuplicates([]);
  };

  const handleSubmit = async (data: IntakeFormData) => {
    // Final duplicate check before submission (covers step 5 "Submit" button)
    const matches = await runDuplicateCheck();
    if (matches.length > 0) {
      setDuplicates(matches);
      setPendingNextStep(null); // null signals "proceed with submission"
      setDuplicateDialogOpen(true);
      return;
    }
    await doSubmit(data);
  };

  const doSubmit = async (data: IntakeFormData) => {
    try {
      const result = await submitMutation.mutateAsync(data);
      router.push(`/clients/${result.id}`);
    } catch {
      // Error handled by mutation
    }
  };

  /** Called from dialog when user confirms on the final submission check. */
  const handleCreateAnywayAndSubmit = () => {
    if (pendingNextStep !== null) {
      handleCreateAnyway();
    } else {
      // We were blocking final submission
      setDuplicates([]);
      const data = methods.getValues() as IntakeFormData;
      void doSubmit(data);
    }
  };

  const handleSaveDraft = () => {
    // TODO: Implement draft saving to backend
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <IntakeStepIdentity />;
      case 2:
        return <IntakeStepContact />;
      case 3:
        return <IntakeStepPreferences />;
      case 4:
        return <IntakeStepLifestyle />;
      case 5:
        return <IntakeStepFamily />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {isEditing ? "Edit Client Profile" : "New Client Intake"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Update client information"
                : "Complete the intake form to add a new client"}
            </p>
          </div>
          {profileId && (
            <Button variant="outline" onClick={() => router.push(`/clients/${profileId}`)}>
              Cancel
            </Button>
          )}
        </div>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
            </span>
            <span className="text-muted-foreground">
              {Math.round(progress)}% complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex gap-2">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => step.id < currentStep && setCurrentStep(step.id)}
              className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                step.id === currentStep
                  ? "border-primary bg-primary/5"
                  : step.id < currentStep
                    ? "border-muted bg-muted/50 cursor-pointer hover:bg-muted"
                    : "border-muted bg-muted/20"
              }`}
              disabled={step.id > currentStep}
            >
              <p
                className={`text-sm font-medium ${
                  step.id <= currentStep ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.id}. {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </button>
          ))}
        </div>

        {/* Form */}
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(handleSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-xl">
                  {STEPS[currentStep - 1].title}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderStep()}</CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </Button>
                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={handleNext}>
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending
                      ? "Submitting..."
                      : isEditing
                        ? "Save Changes"
                        : "Submit Intake"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </FormProvider>
      </div>

      {/* Duplicate warning dialog */}
      <DuplicateWarningDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        duplicates={duplicates}
        onCreateAnyway={handleCreateAnywayAndSubmit}
      />
    </div>
  );
}

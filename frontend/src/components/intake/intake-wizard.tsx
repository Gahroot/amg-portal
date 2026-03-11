"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useAuth } from "@/providers/auth-provider";
import { useSubmitIntake } from "@/hooks/use-intake";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IntakeStepIdentity } from "./intake-step-identity";
import { IntakeStepContact } from "./intake-step-contact";
import { IntakeStepPreferences } from "./intake-step-preferences";
import { IntakeStepLifestyle } from "./intake-step-lifestyle";
import { IntakeStepFamily } from "./intake-step-family";
import type { IntakeFormData } from "@/types/intake-form";

const ALLOWED_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

const intakeSchema = z.object({
  // Step 1 - Identity
  legal_name: z.string().min(1, "Legal name is required"),
  display_name: z.string().optional(),
  entity_type: z.string().optional(),
  jurisdiction: z.string().optional(),
  tax_id: z.string().optional(),

  // Step 2 - Contact
  primary_email: z.email("Please enter a valid email address"),
  secondary_email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),

  // Step 3 - Preferences
  communication_preference: z.string().optional(),
  sensitivities: z.string().optional(),
  special_instructions: z.string().optional(),

  // Step 4 - Lifestyle
  travel_preferences: z.string().optional(),
  dietary_restrictions: z.string().optional(),
  interests: z.string().optional(),
  preferred_destinations: z.array(z.string()).optional(),
  language_preference: z.string().optional(),
});

const STEPS = [
  { id: 1, title: "Identity", description: "Basic information" },
  { id: 2, title: "Contact", description: "Contact details" },
  { id: 3, title: "Preferences", description: "Communication preferences" },
  { id: 4, title: "Lifestyle", description: "Travel and lifestyle" },
  { id: 5, title: "Family", description: "Family members" },
];

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
  const submitMutation = useSubmitIntake();

  const methods = useForm<IntakeFormData>({
    resolver: zodResolver(intakeSchema),
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
        // No required fields for steps 3-5
        break;
    }

    const isValid = await methods.trigger(fieldsToValidate);
    if (isValid) {
      if (currentStep < STEPS.length) {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async (data: IntakeFormData) => {
    try {
      const result = await submitMutation.mutateAsync(data);
      router.push(`/clients/${result.id}`);
    } catch {
      // Error handled by mutation
    }
  };

  const handleSaveDraft = () => {
    // In a real app, this would save to the backend
    console.log("Saving draft...", methods.getValues());
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
    </div>
  );
}

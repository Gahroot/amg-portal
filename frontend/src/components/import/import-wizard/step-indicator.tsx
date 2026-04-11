"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { WizardStep } from "./hooks/use-import-wizard";

const STEP_ORDER: WizardStep[] = [
  "select",
  "upload",
  "mapping",
  "validation",
  "preview",
  "complete",
];

const STEP_LABELS = ["Select", "Upload", "Map", "Validate", "Preview"];

interface StepIndicatorProps {
  currentStep: WizardStep;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEP_ORDER.slice(0, -1).map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/25 text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <span>{index + 1}</span>}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {STEP_LABELS[index]}
                </span>
              </div>
              {index < STEP_ORDER.length - 2 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 transition-colors",
                    index < currentIndex ? "bg-primary" : "bg-muted-foreground/25",
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

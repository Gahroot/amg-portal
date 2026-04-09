"use client";

import { useEffect, useCallback, useMemo } from "react";
import { TourProvider, useTour } from "@reactour/tour";
import type { StylesObj } from "@reactour/tour";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { TourDefinition, TourStep } from "@/lib/tours/config";
import { useToursStore } from "@/stores/tours-store";

/**
 * Custom styles for the tour popover
 */
const tourStyles: StylesObj = {
  badge: () => ({
    display: "none", // We use our own progress indicator
  }),
  controls: () => ({
    display: "none", // We use our own controls
  }),
  navigation: () => ({
    display: "none", // We use our own navigation
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dot: (base: any, state: any) => ({
    ...base,
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: state?.current ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)",
    cursor: state?.onClick ? "pointer" : "default",
    transition: "all 0.2s ease",
  }),
};

/**
 * Props for the GuidedTour component
 */
interface GuidedTourProps {
  /** The tour definition to run */
  tour: TourDefinition;
  /** Starting step index */
  startAt?: number;
  /** Callback when tour completes */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
  /** Callback when tour is closed */
  onClose?: () => void;
}

/**
 * Custom content component for the tour popover
 */
function TourPopoverContent({
  tour,
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSkip,
  onClose: _onClose,
}: {
  tour: TourDefinition;
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const step = tour.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="w-full max-w-sm">
      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2">
        <Progress value={progress} className="h-1" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-2 pb-3">
        <div className="flex-1">
          {step.title && (
            <h3 className="text-base font-semibold text-foreground">
              {step.title}
            </h3>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            Step {currentStep + 1} of {totalSteps}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 text-foreground">
        {step.content}
      </div>

      {/* Footer with navigation */}
      <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/30 rounded-b-xl">
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-muted-foreground"
          >
            Skip tour
          </Button>
          <Button size="sm" onClick={onNext} className="gap-1">
            {isLastStep ? "Finish" : "Next"}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Convert TourStep to reactour Step format
 */
function convertSteps(steps: TourStep[]) {
  return steps.map((step) => ({
    selector: step.selector,
    // Content is rendered via ContentComponent, so we use a placeholder
    content: "" as string,
    position: step.position,
    padding: step.padding ?? 10,
    disableInteraction: step.disableInteraction,
    skipBeacon: step.skipBeacon ?? true,
  }));
}

/**
 * Main guided tour component that wraps the application
 */
export function GuidedTour({
  tour,
  startAt = 0,
  onComplete,
  onSkip,
  onClose,
}: GuidedTourProps) {
  const completeTour = useToursStore((state) => state.completeTour);
  const skipTour = useToursStore((state) => state.skipTour);
  const endTour = useToursStore((state) => state.endTour);

  const handleComplete = useCallback(() => {
    completeTour(tour.id, tour.category);
    onComplete?.();
    onClose?.();
  }, [completeTour, tour.id, tour.category, onComplete, onClose]);

  const handleSkip = useCallback(() => {
    skipTour(tour.id);
    onSkip?.();
    onClose?.();
  }, [skipTour, tour.id, onSkip, onClose]);

  const handleClose = useCallback(() => {
    endTour();
    onClose?.();
  }, [endTour, onClose]);

  const steps = useMemo(() => convertSteps(tour.steps), [tour.steps]);

  // Custom content component that receives reactour's props
  const ContentComponent = useCallback(
    ({ currentStep, setIsOpen }: { currentStep: number; setIsOpen: (open: boolean) => void }) => (
      <TourPopoverContent
        tour={tour}
        currentStep={currentStep}
        totalSteps={steps.length}
        onPrevious={() => {
          // Access internal setCurrentStep through window
          const prevBtn = document.querySelector('[data-tour-prev]') as HTMLButtonElement;
          prevBtn?.click();
        }}
        onNext={() => {
          if (currentStep === steps.length - 1) {
            handleComplete();
            setIsOpen(false);
          }
        }}
        onSkip={() => {
          handleSkip();
          setIsOpen(false);
        }}
        onClose={() => {
          handleClose();
          setIsOpen(false);
        }}
      />
    ),
    [tour, steps.length, handleComplete, handleSkip, handleClose]
  );

  return (
    <TourProvider
      steps={steps}
      startAt={startAt}
      styles={tourStyles}
      padding={10}
      showBadge={false}
      showNavigation={false}
      showCloseButton={false}
      disableInteraction={false}
      disableDotsNavigation={false}
      showDots={true}
      afterOpen={() => {
        // Prevent body scroll when tour is open
        document.body.style.overflow = "hidden";
      }}
      beforeClose={() => {
        // Restore body scroll
        document.body.style.overflow = "";
      }}
      ContentComponent={ContentComponent}
    >
      <GuidedTourInternal
        tour={tour}
        onComplete={handleComplete}
        onSkip={handleSkip}
        onClose={handleClose}
      />
    </TourProvider>
  );
}

/**
 * Internal component that handles tour state
 */
function GuidedTourInternal({
  tour,
  onComplete,
  onSkip,
  onClose,
}: {
  tour: TourDefinition;
  onComplete: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const { isOpen, currentStep, setCurrentStep, setIsOpen } = useTour();
  const startTour = useToursStore((state) => state.startTour);
  const tourState = useToursStore((state) => state.getTourState(tour.id));

  // Start the tour when mounted
  useEffect(() => {
    if (!tourState?.completed) {
      startTour(tour.id);
      setIsOpen(true);
      // Resume from last step if available
      if (tourState?.lastStep && tourState.lastStep > 0) {
        setCurrentStep(tourState.lastStep);
      }
    }
  }, [tour.id, tourState, startTour, setIsOpen, setCurrentStep]);

  const totalSteps = tour.steps.length;
  const currentStepIndex = currentStep ?? 0;
  const step = tour.steps[currentStepIndex];

  const handlePrevious = useCallback(() => {
    setCurrentStep(currentStepIndex - 1);
  }, [currentStepIndex, setCurrentStep]);

  const handleNext = useCallback(() => {
    if (currentStepIndex === totalSteps - 1) {
      onComplete();
      setIsOpen(false);
    } else {
      setCurrentStep(currentStepIndex + 1);
    }
  }, [currentStepIndex, totalSteps, setCurrentStep, onComplete, setIsOpen]);

  // Handle step actions
  useEffect(() => {
    if (isOpen && step?.actionBefore) {
      step.actionBefore();
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  return (
    <TourPopoverContent
      tour={tour}
      currentStep={currentStepIndex}
      totalSteps={totalSteps}
      onPrevious={handlePrevious}
      onNext={handleNext}
      onSkip={() => {
        onSkip();
        setIsOpen(false);
      }}
      onClose={() => {
        onClose();
        setIsOpen(false);
      }}
    />
  );
}

/**
 * Re-export types and utilities
 */
export type { TourStep, TourDefinition } from "@/lib/tours/config";

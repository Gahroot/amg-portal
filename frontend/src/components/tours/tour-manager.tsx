"use client";

import { useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlayCircle, RotateCcw, X, Compass } from "lucide-react";
import { TourProvider, useTour as useReactour } from "@reactour/tour";
import type { StylesObj } from "@reactour/tour";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTours, useTourAutoStart, useTour } from "@/hooks/use-tours";
import {
  getTour,
  getAllTours,
  TOUR_CATEGORY_LABELS,
  TOUR_CATEGORY_DESCRIPTIONS,
  type TourDefinition,
  type TourCategory,
  type TourStep,
} from "@/lib/tours/config";
import { useToursStore } from "@/stores/tours-store";

/**
 * Custom styles for the tour popover
 */
const tourStyles: StylesObj = {
  badge: () => ({ display: "none" }),
  controls: () => ({ display: "none" }),
  navigation: () => ({ display: "none" }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dot: (_base: any, state: any) => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: state?.current ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)",
  }),
};

/**
 * Tour popover content component
 */
function TourPopoverContent({
  tour,
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSkip,
}: {
  tour: TourDefinition;
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const step = tour.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="w-full max-w-sm">
      <div className="px-4 pt-3 pb-2">
        <Progress value={progress} className="h-1" />
      </div>

      <div className="flex items-start justify-between px-4 pt-2 pb-3">
        <div className="flex-1">
          {step.title && (
            <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
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

      <div className="px-4 pb-4 text-foreground">{step.content}</div>

      <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/30 rounded-b-xl">
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <Button variant="ghost" size="sm" onClick={onPrevious} className="gap-1">
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
            Skip tour
          </Button>
          <Button size="sm" onClick={onNext} className="gap-1">
            {isLastStep ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * New user prompt dialog
 */
function NewUserPrompt({
  open,
  onOpenChange,
  onStartTour,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTour: () => void;
  onSkip: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            Welcome to AMG Portal!
          </DialogTitle>
          <DialogDescription>
            Would you like a quick tour of the interface? It only takes a few minutes
            and will help you get started.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">You'll learn about:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Navigation and sidebar</li>
              <li>• Quick actions and shortcuts</li>
              <li>• Key features and tools</li>
            </ul>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onSkip} className="w-full sm:w-auto">
            Skip for now
          </Button>
          <Button onClick={onStartTour} className="w-full sm:w-auto gap-2">
            <PlayCircle className="h-4 w-4" />
            Start Tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tour list item component
 */
function TourListItem({
  tour,
  onStart,
  onRestart,
}: {
  tour: TourDefinition;
  onStart: () => void;
  onRestart: () => void;
}) {
  const { isCompleted, isSkipped } = useTour(tour.id);

  return (
    <div
      className={cn(
        "flex items-start justify-between p-3 rounded-lg border transition-colors",
        isCompleted && "bg-muted/50"
      )}
    >
      <div className="flex items-start gap-3">
        {tour.icon && (
          <div className="mt-0.5 p-2 rounded-lg bg-primary/10 text-primary">
            <tour.icon className="h-4 w-4" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{tour.name}</h4>
            {tour.estimatedTime && (
              <Badge variant="secondary" className="text-xs">
                {tour.estimatedTime}
              </Badge>
            )}
            {isCompleted && (
              <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
                Completed
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{tour.description}</p>
        </div>
      </div>
      <div className="ml-4">
        {isCompleted || isSkipped ? (
          <Button variant="outline" size="sm" onClick={onRestart} className="gap-1">
            <RotateCcw className="h-3 w-3" />
            Restart
          </Button>
        ) : (
          <Button size="sm" onClick={onStart} className="gap-1">
            <PlayCircle className="h-3 w-3" />
            Start
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Tours menu sheet content
 */
function ToursSheetContent() {
  const tours = getAllTours();
  const { beginTour, restartTour } = useTours();

  // Group tours by category
  const groupedTours = tours.reduce(
    (acc, tour) => {
      if (!acc[tour.category]) {
        acc[tour.category] = [];
      }
      acc[tour.category].push(tour);
      return acc;
    },
    {} as Record<TourCategory, TourDefinition[]>
  );

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="space-y-6 pr-4">
        {Object.entries(groupedTours).map(([category, categoryTours]) => (
          <div key={category}>
            <div className="mb-3">
              <h3 className="font-semibold">
                {TOUR_CATEGORY_LABELS[category as TourCategory]}
              </h3>
              <p className="text-sm text-muted-foreground">
                {TOUR_CATEGORY_DESCRIPTIONS[category as TourCategory]}
              </p>
            </div>
            <div className="space-y-2">
              {categoryTours.map((tour) => (
                <TourListItem
                  key={tour.id}
                  tour={tour}
                  onStart={() => beginTour(tour.id)}
                  onRestart={() => restartTour(tour.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/**
 * Button to open the tours menu
 */
export function ToursMenuButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "outline" | "default";
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant={variant} size={variant === "ghost" ? "icon" : "default"} className={className}>
          <PlayCircle className={variant === "ghost" ? "h-5 w-5" : "h-4 w-4 mr-2"} />
          {variant !== "ghost" && "Tours"}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Guided Tours</SheetTitle>
          <SheetDescription>
            Take a guided tour to learn about the portal features
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <ToursSheetContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Internal tour runner component
 */
function TourRunner() {
  const activeTourId = useToursStore((state) => state.activeTourId);
  const completeTour = useToursStore((state) => state.completeTour);
  const skipTour = useToursStore((state) => state.skipTour);
  const endTour = useToursStore((state) => state.endTour);
  const updateProgress = useToursStore((state) => state.updateProgress);
  const tourState = useToursStore((state) =>
    activeTourId ? state.tours[activeTourId] : null
  );

  const tour = activeTourId ? getTour(activeTourId) : null;

  if (!tour || !activeTourId) return null;

  // Convert tour steps to reactour format
  // Position is already limited to valid values in TourStepPosition type
  const steps = tour.steps.map((step: TourStep) => ({
    selector: step.selector,
    content: step.content,
    position: step.position,
    padding: step.padding ?? 10,
    disableInteraction: step.disableInteraction,
    skipBeacon: step.skipBeacon ?? true,
  }));

  const ContentComponent = ({
    currentStep,
    setIsOpen,
  }: {
    currentStep: number;
    setIsOpen: (open: boolean) => void;
  }) => {
    const isLastStep = currentStep === steps.length - 1;

    useEffect(() => {
      updateProgress(activeTourId, currentStep);
    }, [currentStep]);

    return (
      <TourPopoverContent
        tour={tour}
        currentStep={currentStep}
        totalSteps={steps.length}
        onPrevious={() => {
          // Use internal reactour navigation
          const tourWrapper = document.querySelector("[data-tour-wrapper]");
          if (tourWrapper) {
            tourWrapper.dispatchEvent(
              new CustomEvent("tour-prev", { bubbles: true })
            );
          }
        }}
        onNext={() => {
          if (isLastStep) {
            completeTour(activeTourId, tour.category);
            setIsOpen(false);
          }
        }}
        onSkip={() => {
          skipTour(activeTourId);
          setIsOpen(false);
        }}
      />
    );
  };

  return (
    <TourProvider
      steps={steps}
      startAt={tourState?.lastStep ?? 0}
      styles={tourStyles}
      padding={10}
      showBadge={false}
      showNavigation={false}
      showCloseButton={false}
      showDots={true}
      afterOpen={() => {
        document.body.style.overflow = "hidden";
      }}
      beforeClose={() => {
        document.body.style.overflow = "";
        endTour();
      }}
      ContentComponent={ContentComponent}
    >
      <TourRunnerInternal tour={tour} />
    </TourProvider>
  );
}

/**
 * Internal component to handle tour state
 */
function TourRunnerInternal({ tour }: { tour: TourDefinition }) {
  const { isOpen, currentStep, setCurrentStep, setIsOpen } = useReactour();
  const activeTourId = useToursStore((state) => state.activeTourId);
  const completeTour = useToursStore((state) => state.completeTour);
  const skipTour = useToursStore((state) => state.skipTour);

  if (!isOpen || !activeTourId) return null;

  const totalSteps = tour.steps.length;
  const currentStepIndex = currentStep ?? 0;

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(currentStepIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentStepIndex === totalSteps - 1) {
      completeTour(activeTourId, tour.category);
      setIsOpen(false);
    } else {
      setCurrentStep(currentStepIndex + 1);
    }
  };

  const handleSkip = () => {
    skipTour(activeTourId);
    setIsOpen(false);
  };

  return (
    <TourPopoverContent
      tour={tour}
      currentStep={currentStepIndex}
      totalSteps={totalSteps}
      onPrevious={handlePrevious}
      onNext={handleNext}
      onSkip={handleSkip}
    />
  );
}

/**
 * Component that handles URL parameter to start a tour
 */
function TourUrlTrigger() {
  const searchParams = useSearchParams();
  const { beginTour } = useTours();

  useEffect(() => {
    const tourParam = searchParams.get("tour");
    if (tourParam) {
      beginTour(tourParam);
    }
  }, [searchParams, beginTour]);

  return null;
}

/**
 * Main Tour Manager component
 *
 * Add this to your layout to enable:
 * - Auto-start tours for new users
 * - URL parameter tour triggering (?tour=tour-id)
 * - Tour prompt dialog
 */
export function TourManager() {
  const { showPrompt, dismissPrompt } = useTourAutoStart();
  const { beginTour } = useTours();
  const setInitialized = useToursStore((state) => state.setInitialized);

  const handleStartTour = useCallback(() => {
    dismissPrompt();
    beginTour("onboarding");
  }, [dismissPrompt, beginTour]);

  const handleSkipPrompt = useCallback(() => {
    dismissPrompt();
    setInitialized(true);
  }, [dismissPrompt, setInitialized]);

  return (
    <>
      {/* URL trigger handler */}
      <Suspense fallback={null}>
        <TourUrlTrigger />
      </Suspense>

      {/* New user prompt */}
      <NewUserPrompt
        open={showPrompt}
        onOpenChange={(open) => {
          if (!open) handleSkipPrompt();
        }}
        onStartTour={handleStartTour}
        onSkip={handleSkipPrompt}
      />

      {/* Active tour runner */}
      <TourRunner />
    </>
  );
}

export default TourManager;

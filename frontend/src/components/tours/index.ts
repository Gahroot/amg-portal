/**
 * Tours component exports
 */

// Main tour component
export { GuidedTour } from "./guided-tour";

// Tour manager component
export { TourManager, ToursMenuButton } from "./tour-manager";

// Re-export types and config
export {
  type TourDefinition,
  type TourStep,
  type TourCategory,
  type TourState,
  type TourStepPosition,
  TOUR_CATEGORY_LABELS,
  TOUR_CATEGORY_DESCRIPTIONS,
  TOUR_SELECTORS,
  TOUR_DATA_ATTR,
  registerTour,
  getTour,
  getAllTours,
  getToursByCategory,
  getToursForRoute,
} from "@/lib/tours/config";

// Re-export tour hooks
export {
  useTours,
  useTour,
  useTourAutoStart,
  useTourProgress,
} from "@/hooks/use-tours";

// Re-export store hooks
export {
  useToursStore,
  useActiveTourId,
  useTourCompleted,
  useTourSkipped,
  useTourProgress as useTourProgressStore,
  useCompletedTourIds,
  useIsNewUser,
} from "@/stores/tours-store";

// Tour definitions are auto-registered when imported
import "./tours/onboarding-tour";
import "./tours/dashboard-tour";
import "./tours/programs-tour";

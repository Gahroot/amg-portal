/**
 * Hook for managing guided tours
 *
 * Provides a convenient interface for starting, stopping, and checking tour status.
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getTour,
  getAllTours,
  getToursForRoute,
  getAutoStartTours,
  type TourDefinition,
  type TourCategory,
} from "@/lib/tours/config";
import {
  useToursStore,
  useActiveTourId,
  useIsNewUser,
  useCompletedTourIds,
} from "@/stores/tours-store";
import { useAuth } from "@/providers/auth-provider";

/**
 * Main hook for tour management
 */
export function useTours() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const isNewUser = useIsNewUser();
  const activeTourId = useActiveTourId();
  const completedTourIds = useCompletedTourIds();

  const {
    startTour,
    completeTour,
    skipTour,
    endTour,
    resetTour,
    resetAllTours,
    isTourCompleted,
    isTourSkipped,
    getTourState,
    setShowPrompt,
    setInitialized,
    showPrompt,
  } = useToursStore();

  // All available tours
  const allTours = getAllTours();

  // Tours available for current route
  const availableTours = getToursForRoute(pathname);

  // Currently active tour definition
  const activeTour = activeTourId ? getTour(activeTourId) : null;

  /**
   * Start a tour by ID
   */
  const beginTour = useCallback(
    (tourId: string) => {
      const tour = getTour(tourId);
      if (!tour) {
        console.warn(`Tour not found: ${tourId}`);
        return false;
      }

      // Don't start if already completed (unless forced)
      if (isTourCompleted(tourId)) {
        return false;
      }

      startTour(tourId);
      return true;
    },
    [startTour, isTourCompleted]
  );

  /**
   * Restart a tour (even if completed)
   */
  const restartTour = useCallback(
    (tourId: string) => {
      const tour = getTour(tourId);
      if (!tour) {
        console.warn(`Tour not found: ${tourId}`);
        return false;
      }

      // Reset the tour state first
      resetTour(tourId);
      // Then start it
      startTour(tourId);
      return true;
    },
    [resetTour, startTour]
  );

  /**
   * Get tours grouped by category
   */
  const getToursByCategory = useCallback(() => {
    const grouped: Record<TourCategory, TourDefinition[]> = {
      onboarding: [],
      features: [],
      pages: [],
      workflows: [],
      admin: [],
    };

    allTours.forEach((tour) => {
      grouped[tour.category].push(tour);
    });

    return grouped;
  }, [allTours]);

  /**
   * Get recommended tours for the user
   */
  const getRecommendedTours = useCallback(() => {
    return allTours.filter((tour) => {
      // Already completed
      if (isTourCompleted(tour.id)) return false;
      // Already skipped
      if (isTourSkipped(tour.id)) return false;
      // Not available on current route
      if (tour.route && !pathname.startsWith(tour.route)) return false;
      // Not featured
      if (!tour.featured) return false;
      return true;
    });
  }, [allTours, isTourCompleted, isTourSkipped, pathname]);

  /**
   * Check if there are any pending tours to show
   */
  const hasPendingTours = availableTours.some(
    (tour) => !isTourCompleted(tour.id) && !isTourSkipped(tour.id)
  );

  return {
    // State
    allTours,
    availableTours,
    activeTour,
    activeTourId,
    completedTourIds,
    isNewUser,
    hasPendingTours,
    showPrompt,

    // Actions
    beginTour,
    restartTour,
    completeTour,
    skipTour,
    endTour,
    resetTour,
    resetAllTours,
    setShowPrompt,
    setInitialized,

    // Helpers
    isTourCompleted,
    isTourSkipped,
    getTourState,
    getToursByCategory,
    getRecommendedTours,
  };
}

/**
 * Hook for auto-starting tours for new users
 */
export function useTourAutoStart() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const isNewUser = useIsNewUser();
  const showPrompt = useToursStore((state) => state.showPrompt);
  const setShowPrompt = useToursStore((state) => state.setShowPrompt);
  const setInitialized = useToursStore((state) => state.setInitialized);
  const startTour = useToursStore((state) => state.startTour);
  const isTourCompleted = useToursStore((state) => state.isTourCompleted);
  const [hasCheckedAutoStart, setHasCheckedAutoStart] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || hasCheckedAutoStart) return;

    const checkAutoStart = async () => {
      setHasCheckedAutoStart(true);

      // Get tours that should auto-start
      const autoStartTours = getAutoStartTours();

      // Find the first uncompleted auto-start tour
      const tourToStart = autoStartTours.find(
        (tour) => !isTourCompleted(tour.id) && tour.route && pathname.startsWith(tour.route)
      );

      if (tourToStart) {
        // Check custom condition if provided
        if (tourToStart.autoStartCondition) {
          const shouldStart = await tourToStart.autoStartCondition();
          if (!shouldStart) return;
        }

        // Small delay to let the page settle
        setTimeout(() => {
          startTour(tourToStart.id);
        }, 1000);
      } else if (isNewUser) {
        // Show prompt for new users if no auto-start tour
        setShowPrompt(true);
      }

      // Mark as initialized
      setInitialized(true);
    };

    checkAutoStart();
  }, [
    isAuthenticated,
    hasCheckedAutoStart,
    isNewUser,
    pathname,
    startTour,
    isTourCompleted,
    setShowPrompt,
    setInitialized,
  ]);

  return {
    showPrompt,
    dismissPrompt: () => setShowPrompt(false),
  };
}

/**
 * Hook for a specific tour
 */
export function useTour(tourId: string) {
  const tour = getTour(tourId);
  const { beginTour, restartTour, completeTour, skipTour, isTourCompleted, isTourSkipped, getTourState } =
    useTours();

  const state = getTourState(tourId);
  const isCompleted = isTourCompleted(tourId);
  const isSkipped = isTourSkipped(tourId);
  const isActive = useActiveTourId() === tourId;

  return {
    tour,
    state,
    isCompleted,
    isSkipped,
    isActive,
    start: () => beginTour(tourId),
    restart: () => restartTour(tourId),
    complete: () => completeTour(tourId, tour?.category),
    skip: () => skipTour(tourId),
  };
}

/**
 * Hook for tracking tour step progress
 */
export function useTourProgress(tourId: string) {
  const tour = getTour(tourId);
  const state = useToursStore((state) => state.getTourState(tourId));
  const updateProgress = useToursStore((state) => state.updateProgress);

  const totalSteps = tour?.steps.length ?? 0;
  const currentStep = state?.lastStep ?? 0;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  return {
    totalSteps,
    currentStep,
    progress,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
    setStep: (step: number) => updateProgress(tourId, step),
  };
}

// Re-export types
export type { TourDefinition, TourCategory } from "@/lib/tours/config";

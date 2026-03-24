/**
 * Zustand store for managing tour state
 *
 * Tracks completed, skipped, and in-progress tours with persistence to localStorage.
 */

import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TourState, TourCategory } from "@/lib/tours/config";

/**
 * Store state for tours
 */
interface ToursStoreState {
  /** Map of tour ID to tour state */
  tours: Record<string, TourState>;
  /** Currently active tour ID */
  activeTourId: string | null;
  /** Whether the tour system has been initialized */
  initialized: boolean;
  /** Whether to show the tour prompt for new users */
  showPrompt: boolean;
  /** Which categories the user has completed tours in */
  completedCategories: TourCategory[];
}

/**
 * Store actions for tours
 */
interface ToursStoreActions {
  /** Mark a tour as completed */
  completeTour: (tourId: string, category?: TourCategory) => void;
  /** Mark a tour as skipped */
  skipTour: (tourId: string) => void;
  /** Update the last step reached for a tour */
  updateProgress: (tourId: string, stepIndex: number) => void;
  /** Start a tour */
  startTour: (tourId: string) => void;
  /** End the current tour (without marking completed/skipped) */
  endTour: () => void;
  /** Reset a tour to allow restarting */
  resetTour: (tourId: string) => void;
  /** Reset all tours */
  resetAllTours: () => void;
  /** Check if a tour has been completed */
  isTourCompleted: (tourId: string) => boolean;
  /** Check if a tour has been skipped */
  isTourSkipped: (tourId: string) => boolean;
  /** Get state for a specific tour */
  getTourState: (tourId: string) => TourState | undefined;
  /** Get all completed tour IDs */
  getCompletedTourIds: () => string[];
  /** Set whether to show the new user prompt */
  setShowPrompt: (show: boolean) => void;
  /** Mark that the tour system has been initialized */
  setInitialized: (initialized: boolean) => void;
  /** Check if user is new (hasn't completed onboarding tours) */
  isNewUser: () => boolean;
}

type ToursStore = ToursStoreState & ToursStoreActions;

/**
 * Default state for a new tour
 */
const defaultTourState: TourState = {
  completed: false,
  skipped: false,
  startCount: 0,
};

/**
 * Create initial state for the store
 */
const initialState: ToursStoreState = {
  tours: {},
  activeTourId: null,
  initialized: false,
  showPrompt: false,
  completedCategories: [],
};

/**
 * Zustand store for tour state with localStorage persistence
 */
export const useToursStore = create<ToursStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      completeTour: (tourId, category) => {
        set((state) => {
          const existingState = state.tours[tourId] || defaultTourState;
          const newCompletedCategories = category
            ? state.completedCategories.includes(category)
              ? state.completedCategories
              : [...state.completedCategories, category]
            : state.completedCategories;

          return {
            tours: {
              ...state.tours,
              [tourId]: {
                ...existingState,
                completed: true,
                completedAt: new Date().toISOString(),
                lastStep: undefined, // Clear progress on completion
              },
            },
            activeTourId: null,
            completedCategories: newCompletedCategories,
          };
        });
      },

      skipTour: (tourId) => {
        set((state) => {
          const existingState = state.tours[tourId] || defaultTourState;
          return {
            tours: {
              ...state.tours,
              [tourId]: {
                ...existingState,
                skipped: true,
                skippedAt: new Date().toISOString(),
              },
            },
            activeTourId: null,
          };
        });
      },

      updateProgress: (tourId, stepIndex) => {
        set((state) => {
          const existingState = state.tours[tourId] || defaultTourState;
          // Don't update progress if already completed
          if (existingState.completed) return state;
          return {
            tours: {
              ...state.tours,
              [tourId]: {
                ...existingState,
                lastStep: stepIndex,
              },
            },
          };
        });
      },

      startTour: (tourId) => {
        set((state) => {
          const existingState = state.tours[tourId] || defaultTourState;
          return {
            tours: {
              ...state.tours,
              [tourId]: {
                ...existingState,
                startCount: existingState.startCount + 1,
                skipped: false, // Reset skipped if restarting
                skippedAt: undefined,
              },
            },
            activeTourId: tourId,
          };
        });
      },

      endTour: () => {
        set({ activeTourId: null });
      },

      resetTour: (tourId) => {
        set((state) => {
           
          const { [tourId]: _, ...remainingTours } = state.tours;
          return {
            tours: remainingTours,
          };
        });
      },

      resetAllTours: () => {
        set({
          tours: {},
          activeTourId: null,
          completedCategories: [],
          showPrompt: true,
        });
      },

      isTourCompleted: (tourId) => {
        const state = get();
        return state.tours[tourId]?.completed ?? false;
      },

      isTourSkipped: (tourId) => {
        const state = get();
        return state.tours[tourId]?.skipped ?? false;
      },

      getTourState: (tourId) => {
        return get().tours[tourId];
      },

      getCompletedTourIds: () => {
        const state = get();
        return Object.entries(state.tours)
           
          .filter(([_id, tourState]) => tourState.completed)
          .map(([id]) => id);
      },

      setShowPrompt: (show) => {
        set({ showPrompt: show });
      },

      setInitialized: (initialized) => {
        set({ initialized });
      },

      isNewUser: () => {
        const state = get();
        // User is new if they haven't completed any onboarding tours
        const completedCount = Object.values(state.tours).filter(
          (t) => t.completed
        ).length;
        return completedCount === 0 && !state.initialized;
      },
    }),
    {
      name: "amg-tours",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tours: state.tours,
        initialized: state.initialized,
        completedCategories: state.completedCategories,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Get the currently active tour ID
 */
export function useActiveTourId() {
  return useToursStore((state) => state.activeTourId);
}

/**
 * Check if a specific tour is completed
 */
export function useTourCompleted(tourId: string) {
  return useToursStore((state) => state.tours[tourId]?.completed ?? false);
}

/**
 * Check if a specific tour is skipped
 */
export function useTourSkipped(tourId: string) {
  return useToursStore((state) => state.tours[tourId]?.skipped ?? false);
}

/**
 * Get the last step reached for a tour (for resuming)
 */
export function useTourProgress(tourId: string) {
  return useToursStore((state) => state.tours[tourId]?.lastStep);
}

/**
 * Get all completed tour IDs
 */
export function useCompletedTourIds() {
  return useToursStore(
    useShallow((state) =>
      Object.entries(state.tours)
         
        .filter(([_id, t]) => t.completed)
        .map(([id]) => id)
    )
  );
}

/**
 * Check if user is new (hasn't completed onboarding)
 */
export function useIsNewUser() {
  return useToursStore((state) => {
    const completedCount = Object.values(state.tours).filter(
      (t) => t.completed
    ).length;
    return completedCount === 0 && !state.initialized;
  });
}

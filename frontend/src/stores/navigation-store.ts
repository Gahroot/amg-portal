"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Filter state for a specific route
 */
export interface RouteFilterState {
  /** Search input value */
  search?: string;
  /** Status filter value */
  status?: string;
  /** Additional filter values (e.g., compliance_status, availability, boolean flags) */
  [key: string]: string | boolean | undefined;
}

/**
 * Pagination state for a specific route
 */
export interface RoutePaginationState {
  /** Current page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Skip offset for API calls */
  skip?: number;
}

/**
 * Complete navigation state for a route
 */
export interface RouteNavigationState {
  /** Scroll position in pixels from top */
  scrollY: number;
  /** Active filters */
  filters: RouteFilterState;
  /** Sort configuration */
  sort?: {
    column: string;
    direction: "asc" | "desc";
  };
  /** Pagination state */
  pagination: RoutePaginationState;
  /** Timestamp when this state was saved */
  timestamp: number;
}

/**
 * Navigation store state
 */
interface NavigationStoreState {
  /** Navigation state per route path */
  routeStates: Record<string, RouteNavigationState>;
  /** Routes that should restore state on next visit */
  pendingRestores: Record<string, boolean>;
}

/**
 * Navigation store actions
 */
interface NavigationStoreActions {
  /** Save navigation state for a route */
  saveState: (route: string, state: Partial<RouteNavigationState>) => void;
  /** Get navigation state for a route */
  getState: (route: string) => RouteNavigationState | undefined;
  /** Clear navigation state for a route */
  clearState: (route: string) => void;
  /** Mark a route for state restoration on next visit */
  setPendingRestore: (route: string, pending: boolean) => void;
  /** Check if a route has pending restoration */
  hasPendingRestore: (route: string) => boolean;
  /** Clear pending restoration flag for a route */
  clearPendingRestore: (route: string) => void;
  /** Reset all navigation state */
  resetAll: () => void;
}

type NavigationStore = NavigationStoreState & NavigationStoreActions;

/**
 * Default navigation state
 */
const createDefaultState = (): RouteNavigationState => ({
  scrollY: 0,
  filters: {},
  pagination: {},
  timestamp: Date.now(),
});

/**
 * Normalize route path for consistent key usage
 */
function normalizeRoute(route: string): string {
  // Remove trailing slash and query params for consistent keys
  return route.replace(/\/$/, "").split("?")[0] || "/";
}

/**
 * Zustand store for navigation state preservation
 * Uses sessionStorage to persist state across page reloads
 */
export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set, get) => ({
      routeStates: {},
      pendingRestores: {},

      saveState: (route, state) => {
        const normalizedRoute = normalizeRoute(route);
        set((prev) => {
          const existingState = prev.routeStates[normalizedRoute] || createDefaultState();
          return {
            routeStates: {
              ...prev.routeStates,
              [normalizedRoute]: {
                ...existingState,
                ...state,
                timestamp: Date.now(),
              },
            },
          };
        });
      },

      getState: (route) => {
        const normalizedRoute = normalizeRoute(route);
        return get().routeStates[normalizedRoute];
      },

      clearState: (route) => {
        const normalizedRoute = normalizeRoute(route);
        set((prev) => {
          const { [normalizedRoute]: _, ...remaining } = prev.routeStates;
          return { routeStates: remaining };
        });
      },

      setPendingRestore: (route, pending) => {
        const normalizedRoute = normalizeRoute(route);
        set((prev) => ({
          pendingRestores: {
            ...prev.pendingRestores,
            [normalizedRoute]: pending,
          },
        }));
      },

      hasPendingRestore: (route) => {
        const normalizedRoute = normalizeRoute(route);
        return get().pendingRestores[normalizedRoute] === true;
      },

      clearPendingRestore: (route) => {
        const normalizedRoute = normalizeRoute(route);
        set((prev) => {
          const { [normalizedRoute]: _, ...remaining } = prev.pendingRestores;
          return { pendingRestores: remaining };
        });
      },

      resetAll: () => {
        set({ routeStates: {}, pendingRestores: {} });
      },
    }),
    {
      name: "amg-navigation-state",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        routeStates: state.routeStates,
        pendingRestores: state.pendingRestores,
      }),
    }
  )
);

/**
 * Hook to get the saved filters for a route
 */
export function useRouteFilters(route: string): RouteFilterState | undefined {
  return useNavigationStore((state) => state.routeStates[normalizeRoute(route)]?.filters);
}

/**
 * Hook to get the saved scroll position for a route
 */
export function useRouteScrollPosition(route: string): number {
  return useNavigationStore((state) => state.routeStates[normalizeRoute(route)]?.scrollY ?? 0);
}

/**
 * Hook to get the saved pagination state for a route
 */
export function useRoutePagination(route: string): RoutePaginationState | undefined {
  return useNavigationStore((state) => state.routeStates[normalizeRoute(route)]?.pagination);
}

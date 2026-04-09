"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useNavigationStore,
  type RouteFilterState,
  type RoutePaginationState,
} from "@/stores/navigation-store";

/**
 * Options for the useNavigationState hook
 */
export interface UseNavigationStateOptions {
  /** Enable scroll position restoration */
  restoreScroll?: boolean;
  /** Enable filter state restoration */
  restoreFilters?: boolean;
  /** Enable pagination state restoration */
  restorePagination?: boolean;
  /** Debounce time for saving scroll position (ms) */
  scrollDebounce?: number;
  /** Whether to restore on initial mount only (not on every re-render) */
  restoreOnce?: boolean;
}

/**
 * Return type for the useNavigationState hook
 */
export interface UseNavigationStateReturn<F extends RouteFilterState = RouteFilterState> {
  /** Current filter state (from store if restored, or initial) */
  filters: F;
  /** Update filter state and save to store */
  setFilters: (filters: Partial<F>) => void;
  /** Reset filters to initial state and clear from store */
  resetFilters: () => void;
  /** Whether this is a restored state (vs fresh page load) */
  isRestored: boolean;
  /** Scroll position to restore */
  scrollY: number;
  /** Manually save current scroll position */
  saveScrollPosition: (y?: number) => void;
  /** Manually restore scroll position */
  restoreScrollPosition: () => void;
  /** Pagination state */
  pagination: RoutePaginationState;
  /** Update pagination state */
  setPagination: (pagination: Partial<RoutePaginationState>) => void;
  /** Mark route for restoration on next visit (call before navigating away) */
  markForRestore: () => void;
  /** Clear restoration marker */
  clearRestoreMarker: () => void;
  /** Check if there's a pending restore */
  hasPendingRestore: boolean;
  /** Complete URL params string from saved state */
  getRestoredUrlParams: () => string;
}

/**
 * Hook to manage navigation state (scroll, filters, pagination) for a route
 *
 * @example
 * ```tsx
 * function ProgramsList() {
 *   const {
 *     filters,
 *     setFilters,
 *     resetFilters,
 *     isRestored,
 *     restoreScrollPosition,
 *     markForRestore,
 *   } = useNavigationState({
 *     routeKey: "/programs",
 *     initialFilters: { status: "all", search: "" },
 *     restoreScroll: true,
 *     restoreFilters: true,
 *   });
 *
 *   // Mark for restore when navigating to detail page
 *   const handleNavigateToDetail = (id: string) => {
 *     markForRestore();
 *     router.push(`/programs/${id}`);
 *   };
 *
 *   // Restore scroll after data loads
 *   useEffect(() => {
 *     if (isRestored && !isLoading) {
 *       restoreScrollPosition();
 *     }
 *   }, [isRestored, isLoading]);
 * }
 * ```
 */
export function useNavigationState<F extends RouteFilterState = RouteFilterState>(
  options: {
    /** Unique key for this route (usually the pathname) */
    routeKey?: string;
    /** Initial filter values */
    initialFilters?: F;
    /** Initial pagination values */
    initialPagination?: RoutePaginationState;
  } & UseNavigationStateOptions = {}
): UseNavigationStateReturn<F> {
  const {
    routeKey: propRouteKey,
    initialFilters = {} as F,
    initialPagination = {},
    restoreScroll = true,
    restoreFilters = true,
    restorePagination = true,
    _scrollDebounce = 100,
    restoreOnce = true,
  } = options;

  const pathname = usePathname();
  const _router = useRouter();
  const routeKey = propRouteKey || pathname;

  // Store references
  const { saveState, getState, clearState, setPendingRestore, hasPendingRestore: checkPendingRestore, clearPendingRestore } = useNavigationStore();

  // Track if we've already restored state this session
  const [hasRestored, setHasRestored] = useState(false);

  // Get the saved state
  const savedState = getState(routeKey);
  const shouldRestore = checkPendingRestore(routeKey);

  // Determine if we should restore
  const canRestore = restoreOnce ? !hasRestored && shouldRestore : shouldRestore;
  const isRestored = canRestore && !!savedState;

  // Initialize state from saved state or initial values
  const [filters, setFiltersState] = useState<F>(() => {
    return initialFilters;
  });

  const [pagination, setPaginationState] = useState<RoutePaginationState>(() => {
    return initialPagination;
  });

  const scrollY = restoreScroll && canRestore && savedState?.scrollY ? savedState.scrollY : 0;

  // Restore state on mount
  useEffect(() => {
    if (isRestored) {
      setHasRestored(true);
      // Restore filters
      if (restoreFilters && savedState?.filters) {
        setFiltersState((prev) => ({ ...prev, ...savedState.filters } as F));
      }
      // Restore pagination
      if (restorePagination && savedState?.pagination) {
        setPaginationState((prev) => ({ ...prev, ...savedState.pagination }));
      }
      // Clear the pending restore flag after restoration
      clearPendingRestore(routeKey);
    }
  }, [isRestored, routeKey, clearPendingRestore, restoreFilters, restorePagination, savedState]);

  // Update filters and save to store
  const setFilters = useCallback(
    (newFilters: Partial<F>) => {
      setFiltersState((prev) => {
        const updated = { ...prev, ...newFilters };
        saveState(routeKey, { filters: updated });
        return updated;
      });
    },
    [routeKey, saveState]
  );

  // Reset filters to initial state
  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    clearState(routeKey);
  }, [initialFilters, routeKey, clearState]);

  // Update pagination and save to store
  const setPagination = useCallback(
    (newPagination: Partial<RoutePaginationState>) => {
      setPaginationState((prev) => {
        const updated = { ...prev, ...newPagination };
        saveState(routeKey, { pagination: updated });
        return updated;
      });
    },
    [routeKey, saveState]
  );

  // Save scroll position
  const saveScrollPosition = useCallback(
    (y?: number) => {
      const scrollY = y ?? window.scrollY;
      saveState(routeKey, { scrollY });
    },
    [routeKey, saveState]
  );

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    if (scrollY > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
      });
    }
  }, [scrollY]);

  // Mark route for restoration on next visit
  const markForRestore = useCallback(() => {
    setPendingRestore(routeKey, true);
    // Save current scroll position
    saveScrollPosition();
  }, [routeKey, setPendingRestore, saveScrollPosition]);

  // Clear restoration marker
  const clearRestoreMarker = useCallback(() => {
    clearPendingRestore(routeKey);
  }, [routeKey, clearPendingRestore]);

  // Build URL params from saved state
  const getRestoredUrlParams = useCallback(() => {
    if (!savedState?.filters) return "";

    const params = new URLSearchParams();
    Object.entries(savedState.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== "all") {
        // Convert boolean to string for URL params
        params.set(key, String(value));
      }
    });

    const paramsString = params.toString();
    return paramsString ? `?${paramsString}` : "";
  }, [savedState]);

  // Check if there's a pending restore
  const hasPendingRestore = checkPendingRestore(routeKey);

  return {
    filters,
    setFilters,
    resetFilters,
    isRestored,
    scrollY,
    saveScrollPosition,
    restoreScrollPosition,
    pagination,
    setPagination,
    markForRestore,
    clearRestoreMarker,
    hasPendingRestore,
    getRestoredUrlParams,
  };
}

/**
 * Hook to track and save scroll position on scroll events
 * Use this in list components to automatically save scroll position
 */
export function useScrollTracker(routeKey?: string, debounce = 100) {
  const pathname = usePathname();
  const key = routeKey || pathname;
  const { saveState } = useNavigationStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Only save if scroll position changed significantly
      if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

      lastScrollY.current = currentScrollY;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        saveState(key, { scrollY: currentScrollY });
      }, debounce);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, debounce, saveState]);
}

/**
 * Hook to restore scroll position on component mount
 * Call this after data has loaded
 */
export function useScrollRestore(routeKey?: string, enabled = true) {
  const pathname = usePathname();
  const key = routeKey || pathname;
  const { getState, hasPendingRestore, clearPendingRestore } = useNavigationStore();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;

    const shouldRestore = hasPendingRestore(key);
    if (!shouldRestore) return;

    const savedState = getState(key);
    if (savedState?.scrollY && savedState.scrollY > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedState.scrollY, behavior: "instant" as ScrollBehavior });
        hasRestoredRef.current = true;
        clearPendingRestore(key);
      });
    }
  }, [key, enabled, getState, hasPendingRestore, clearPendingRestore]);
}

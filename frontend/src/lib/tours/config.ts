/**
 * Tour configuration types and registry
 *
 * This module defines the structure for guided tours throughout the application.
 * Tours use @reactour/tour to highlight elements and guide users through features.
 */

import type { ReactElement } from "react";

/**
 * Tour step position relative to the target element
 * Matches @reactour/tour's Position type
 */
export type TourStepPosition =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "center";

/**
 * Single step in a guided tour
 */
export interface TourStep {
  /** Unique identifier for this step */
  id: string;
  /** CSS selector for the target element to highlight */
  selector: string;
  /** Title displayed in the tour popover */
  title?: string;
  /** Main content - can be string or ReactElement for rich content */
  content: ReactElement | string;
  /** Position of the popover relative to the target */
  position?: TourStepPosition;
  /** Optional action to perform before showing this step */
  actionBefore?: () => void | Promise<void>;
  /** Optional action to perform after completing this step */
  actionAfter?: () => void | Promise<void>;
  /** Custom padding around the highlighted element (default: 10) */
  padding?: number;
  /** Whether to disable interaction with the highlighted element */
  disableInteraction?: boolean;
  /** Whether to skip the beacon (pulsing dot that starts the step) */
  skipBeacon?: boolean;
  /** Custom styles for this step's popover */
  styles?: Record<string, React.CSSProperties>;
}

/**
 * Definition of a complete guided tour
 */
export interface TourDefinition {
  /** Unique identifier for this tour */
  id: string;
  /** Display name for the tour */
  name: string;
  /** Description shown in tour selection UI */
  description: string;
  /** Category for organizing tours */
  category: TourCategory;
  /** Ordered list of steps */
  steps: TourStep[];
  /** Optional route where this tour should be available */
  route?: string;
  /** Routes where this tour can be started from */
  startRoutes?: string[];
  /** Whether this tour should auto-start for new users */
  autoStart?: boolean;
  /** Condition to check if tour should auto-start */
  autoStartCondition?: () => boolean | Promise<boolean>;
  /** Optional badge showing estimated time */
  estimatedTime?: string;
  /** Optional icon for the tour */
  icon?: React.ComponentType<{ className?: string }>;
  /** Whether this tour is featured/promoted */
  featured?: boolean;
  /** Order priority (lower = shown first) */
  order?: number;
}

/**
 * Tour categories for organization
 */
export type TourCategory =
  | "onboarding"
  | "features"
  | "pages"
  | "workflows"
  | "admin";

/**
 * Category labels for display
 */
export const TOUR_CATEGORY_LABELS: Record<TourCategory, string> = {
  onboarding: "Getting Started",
  features: "Features",
  pages: "Page Tours",
  workflows: "Workflows",
  admin: "Admin",
};

/**
 * Category descriptions
 */
export const TOUR_CATEGORY_DESCRIPTIONS: Record<TourCategory, string> = {
  onboarding: "Essential guides for new users",
  features: "Learn about key features",
  pages: "Explore specific pages",
  workflows: "Step-by-step process guides",
  admin: "Administrative features",
};

/**
 * State of a tour for a user
 */
export interface TourState {
  /** Whether the tour has been completed */
  completed: boolean;
  /** When the tour was completed */
  completedAt?: string;
  /** Whether the tour was skipped */
  skipped: boolean;
  /** When the tour was skipped */
  skippedAt?: string;
  /** Last step reached (for resuming) */
  lastStep?: number;
  /** Number of times the tour was started */
  startCount: number;
}

/**
 * Tour registry - maps tour IDs to their definitions
 */
const tourRegistry = new Map<string, TourDefinition>();

/**
 * Register a tour definition
 */
export function registerTour(tour: TourDefinition): void {
  tourRegistry.set(tour.id, tour);
}

/**
 * Get a tour definition by ID
 */
export function getTour(id: string): TourDefinition | undefined {
  return tourRegistry.get(id);
}

/**
 * Get all registered tours
 */
export function getAllTours(): TourDefinition[] {
  return Array.from(tourRegistry.values()).sort((a, b) => {
    const orderA = a.order ?? 100;
    const orderB = b.order ?? 100;
    return orderA - orderB;
  });
}

/**
 * Get tours by category
 */
export function getToursByCategory(category: TourCategory): TourDefinition[] {
  return getAllTours().filter((tour) => tour.category === category);
}

/**
 * Get tours that can start on a specific route
 */
export function getToursForRoute(route: string): TourDefinition[] {
  return getAllTours().filter((tour) => {
    if (tour.route && route.startsWith(tour.route)) {
      return true;
    }
    if (tour.startRoutes?.some((r) => route.startsWith(r))) {
      return true;
    }
    return false;
  });
}

/**
 * Get tours that should auto-start
 */
export function getAutoStartTours(): TourDefinition[] {
  return getAllTours().filter((tour) => tour.autoStart);
}

/**
 * Common CSS selectors for tour targets
 * These provide consistent selectors throughout the app
 */
export const TOUR_SELECTORS = {
  // Navigation
  sidebar: "[data-tour='sidebar']",
  sidebarNav: "[data-tour='sidebar-nav']",
  sidebarTrigger: "[data-tour='sidebar-trigger']",
  breadcrumbs: "[data-tour='breadcrumbs']",
  commandPalette: "[data-tour='command-palette']",

  // Header
  header: "[data-tour='header']",
  helpButton: "[data-tour='help-button']",
  notificationBell: "[data-tour='notification-bell']",
  userMenu: "[data-tour='user-menu']",

  // Dashboard
  dashboard: "[data-tour='dashboard']",
  quickActions: "[data-tour='quick-actions']",
  quickTaskButton: "[data-tour='quick-task-button']",

  // Main content
  mainContent: "#main-content",

  // Common
  searchInput: "[data-tour='search-input']",
  filterButton: "[data-tour='filter-button']",
  createButton: "[data-tour='create-button']",
  tableActions: "[data-tour='table-actions']",
  pagination: "[data-tour='pagination']",
} as const;

/**
 * Data attribute to add to elements for tour targeting
 */
export const TOUR_DATA_ATTR = "data-tour";

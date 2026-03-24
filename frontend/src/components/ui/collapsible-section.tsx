"use client";

import * as React from "react";
import { ChevronDown, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Completion status for a collapsible section
 */
export type CompletionStatus = "complete" | "incomplete" | "partial" | "error";

/**
 * Props for the CollapsibleSection component
 */
export interface CollapsibleSectionProps {
  /** Unique identifier for the section (used for state persistence) */
  id: string;
  /** Section title displayed in the header */
  title: string;
  /** Optional description shown below the title */
  description?: string;
  /** Section content */
  children: React.ReactNode;
  /** Whether the section is expanded by default */
  defaultExpanded?: boolean;
  /** Controlled expanded state (makes component controlled) */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Whether to persist expanded state in localStorage */
  persistState?: boolean;
  /** Completion status indicator */
  completionStatus?: CompletionStatus;
  /** Whether this section contains required fields */
  hasRequiredFields?: boolean;
  /** Number of validation errors in this section */
  errorCount?: number;
  /** Additional badge to show in header */
  badge?: React.ReactNode;
  /** Additional className for the container */
  className?: string;
  /** Additional className for the header */
  headerClassName?: string;
  /** Additional className for the content */
  contentClassName?: string;
  /** Whether the section is disabled */
  disabled?: boolean;
  /** Whether to force expanded state (ignores user interaction) */
  forceExpanded?: boolean;
}

const statusConfig: Record<
  CompletionStatus,
  { icon: typeof CheckCircle2; color: string; label: string }
> = {
  complete: {
    icon: CheckCircle2,
    color: "text-green-500",
    label: "Complete",
  },
  incomplete: {
    icon: Circle,
    color: "text-muted-foreground",
    label: "Not started",
  },
  partial: {
    icon: Circle,
    color: "text-amber-500",
    label: "In progress",
  },
  error: {
    icon: AlertCircle,
    color: "text-destructive",
    label: "Has errors",
  },
};

/**
 * Get the persisted state key for a section
 */
function getPersistKey(id: string): string {
  return `collapsible-section-${id}`;
}

/**
 * Get persisted expanded state from localStorage
 */
function getPersistedState(id: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(getPersistKey(id));
    return value !== null ? value === "true" : null;
  } catch {
    return null;
  }
}

/**
 * Persist expanded state to localStorage
 */
function persistState(id: string, expanded: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getPersistKey(id), String(expanded));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * A collapsible section component with smooth animations and state persistence.
 * Designed for organizing long forms into manageable sections.
 *
 * @example
 * ```tsx
 * <CollapsibleSection
 *   id="contact-info"
 *   title="Contact Information"
 *   description="Primary contact details"
 *   completionStatus="complete"
 *   defaultExpanded
 * >
 *   <FormFields />
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
  id,
  title,
  description,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  persistState: shouldPersistState = true,
  completionStatus,
  hasRequiredFields = false,
  errorCount = 0,
  badge,
  className,
  headerClassName,
  contentClassName,
  disabled = false,
  forceExpanded = false,
}: CollapsibleSectionProps) {
  // Initialize state from localStorage if persisting
  const getInitialState = React.useCallback(() => {
    if (shouldPersistState) {
      const persisted = getPersistedState(id);
      if (persisted !== null) return persisted;
    }
    return defaultExpanded;
  }, [id, defaultExpanded, shouldPersistState]);

  const [internalExpanded, setInternalExpanded] = React.useState(getInitialState);

  // Handle controlled vs uncontrolled state
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = forceExpanded || (isControlled ? controlledExpanded : internalExpanded);

  // Update internal state when controlled prop changes
  React.useEffect(() => {
    if (isControlled && controlledExpanded !== internalExpanded) {
      setInternalExpanded(controlledExpanded);
    }
  }, [isControlled, controlledExpanded, internalExpanded]);

  const handleToggle = React.useCallback(() => {
    if (disabled || forceExpanded) return;

    const newExpanded = !isExpanded;

    if (!isControlled) {
      setInternalExpanded(newExpanded);
    }

    if (shouldPersistState) {
      persistState(id, newExpanded);
    }

    onExpandedChange?.(newExpanded);
  }, [disabled, forceExpanded, isExpanded, isControlled, shouldPersistState, id, onExpandedChange]);

  // Get status icon and color
  const status = completionStatus ? statusConfig[completionStatus] : null;
  const StatusIcon = status?.icon;

  return (
    <div
      data-slot="collapsible-section"
      className={cn(
        "rounded-lg border bg-card transition-colors",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
      data-expanded={isExpanded}
      data-disabled={disabled}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || forceExpanded}
        className={cn(
          "flex w-full items-center justify-between gap-3 p-4 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed",
          forceExpanded && "cursor-default",
          headerClassName
        )}
        aria-expanded={isExpanded}
        aria-controls={`${id}-content`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Status indicator */}
          {StatusIcon && (
            <StatusIcon
              className={cn(
                "size-5 shrink-0",
                status?.color,
                completionStatus === "partial" && "fill-amber-500/20"
              )}
              aria-hidden="true"
            />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{title}</span>
              {hasRequiredFields && (
                <Badge variant="outline" className="text-xs">
                  Required
                </Badge>
              )}
              {badge}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground truncate">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Error count badge */}
          {errorCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="size-3" />
              {errorCount} {errorCount === 1 ? "error" : "errors"}
            </Badge>
          )}

          {/* Expand/collapse chevron */}
          {!forceExpanded && (
            <ChevronDown
              className={cn(
                "size-5 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
              aria-hidden="true"
            />
          )}
        </div>
      </button>

      {/* Content with animation */}
      <div
        id={`${id}-content`}
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
        aria-hidden={!isExpanded}
      >
        <div
          className={cn(
            "border-t px-4 py-4",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Props for CollapsibleSectionGroup component
 */
export interface CollapsibleSectionGroupProps {
  /** Group of collapsible sections */
  children: React.ReactNode;
  /** Whether to allow multiple sections to be expanded at once */
  allowMultiple?: boolean;
  /** Callback when any section's expanded state changes */
  onSectionChange?: (sectionId: string, expanded: boolean) => void;
  /** Expand all sections */
  expandAll?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Context for managing a group of collapsible sections
 */
const CollapsibleSectionGroupContext = React.createContext<{
  allowMultiple: boolean;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  expandAll: boolean;
} | null>(null);

/**
 * Hook to access collapsible section group context
 */
export function useCollapsibleSectionGroup() {
  const context = React.useContext(CollapsibleSectionGroupContext);
  return context;
}

/**
 * A group of collapsible sections with coordinated state management.
 * Supports accordion-style behavior (single section open) or multiple open sections.
 *
 * @example
 * ```tsx
 * <CollapsibleSectionGroup allowMultiple={false}>
 *   <CollapsibleSection id="section1" title="Section 1">
 *     Content
 *   </CollapsibleSection>
 *   <CollapsibleSection id="section2" title="Section 2">
 *     Content
 *   </CollapsibleSection>
 * </CollapsibleSectionGroup>
 * ```
 */
export function CollapsibleSectionGroup({
  children,
  allowMultiple = true,
  onSectionChange,
  expandAll = false,
  className,
}: CollapsibleSectionGroupProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set());

  const toggleSection = React.useCallback(
    (id: string) => {
      setExpandedSections((prev) => {
        const next = new Set(prev);

        if (allowMultiple) {
          // Toggle the clicked section
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        } else {
          // Accordion mode: close all, open clicked
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.clear();
            next.add(id);
          }
        }

        onSectionChange?.(id, next.has(id));
        return next;
      });
    },
    [allowMultiple, onSectionChange]
  );

  const contextValue = React.useMemo(
    () => ({
      allowMultiple,
      expandedSections,
      toggleSection,
      expandAll,
    }),
    [allowMultiple, expandedSections, toggleSection, expandAll]
  );

  return (
    <CollapsibleSectionGroupContext.Provider value={contextValue}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </CollapsibleSectionGroupContext.Provider>
  );
}

/**
 * Props for ExpandAllButton component
 */
export interface ExpandAllButtonProps {
  /** Sections to control */
  sections: Array<{ id: string }>;
  /** Callback when expand all is clicked */
  onExpandAll: () => void;
  /** Callback when collapse all is clicked */
  onCollapseAll: () => void;
  /** Additional className */
  className?: string;
}

/**
 * A button to expand or collapse all sections in a form
 */
export function ExpandAllButton({
  sections,
  onExpandAll,
  onCollapseAll,
  className,
}: ExpandAllButtonProps) {
  const groupContext = useCollapsibleSectionGroup();
  const expandedCount = groupContext?.expandedSections.size ?? 0;
  const totalCount = sections.length;
  const allExpanded = expandedCount === totalCount;

  if (totalCount === 0) return null;

  return (
    <button
      type="button"
      onClick={allExpanded ? onCollapseAll : onExpandAll}
      className={cn(
        "text-sm text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      {allExpanded ? "Collapse all" : "Expand all"}
    </button>
  );
}

export default CollapsibleSection;

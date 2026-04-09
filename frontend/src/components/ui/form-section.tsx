"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useFormContext, useFormState, FieldPath, FieldValues } from "react-hook-form";
import {
  CollapsibleSection,
  type CollapsibleSectionProps,
  type CompletionStatus,
} from "@/components/ui/collapsible-section";
import { Badge } from "@/components/ui/badge";

/**
 * Props for FormSection component
 */
export interface FormSectionProps<T extends FieldValues = FieldValues>
  extends Omit<
    CollapsibleSectionProps,
    "completionStatus" | "errorCount" | "hasRequiredFields"
  > {
  /** Field names to watch for completion status */
  fields?: Array<FieldPath<T>>;
  /** Required field names (used to determine if section has required fields) */
  requiredFields?: Array<FieldPath<T>>;
  /** Custom function to determine completion status */
  getCompletionStatus?: (values: Partial<T>, errors: Record<string, unknown>) => CompletionStatus;
  /** Show completion status indicator */
  showCompletionStatus?: boolean;
  /** Auto-expand section when there are validation errors */
  autoExpandOnError?: boolean;
  /** Mark as required section (shows badge) */
  isRequired?: boolean;
}

/**
 * Determine completion status based on field values
 */
function getFieldsCompletionStatus(
  values: Record<string, unknown>,
  fields: string[],
  requiredFields: string[],
  errors: Record<string, unknown>
): CompletionStatus {
  // If there are errors, return error status
  const fieldErrors = fields.filter((field) => {
    // Check if the field or any nested field has an error
    return Object.keys(errors).some(
      (errorKey) => errorKey === field || errorKey.startsWith(`${field}.`)
    );
  });

  if (fieldErrors.length > 0) {
    return "error";
  }

  // Check required fields first
  const requiredFilled = requiredFields.filter((field) => {
    const value = values[field];
    return value !== undefined && value !== null && value !== "";
  });

  // If not all required fields are filled
  if (requiredFilled.length < requiredFields.length) {
    // If some are filled, it's partial
    if (requiredFilled.length > 0) {
      return "partial";
    }
    // If none are filled
    return "incomplete";
  }

  // Check optional fields
  const optionalFields = fields.filter((f) => !requiredFields.includes(f));
  const optionalFilled = optionalFields.filter((field) => {
    const value = values[field];
    return value !== undefined && value !== null && value !== "";
  });

  // All required filled, some optional filled
  if (optionalFields.length > 0 && optionalFilled.length < optionalFields.length) {
    return "partial";
  }

  // All filled
  return "complete";
}

/**
 * Count errors for specific fields
 */
function countFieldErrors(
  fields: string[],
  errors: Record<string, unknown>
): number {
  return fields.filter((field) => {
    return Object.keys(errors).some(
      (errorKey) => errorKey === field || errorKey.startsWith(`${field}.`)
    );
  }).length;
}

/**
 * A collapsible section component designed for use in forms.
 * Automatically tracks completion status and validation errors for the specified fields.
 *
 * @example
 * ```tsx
 * <FormSection
 *   id="contact-info"
 *   title="Contact Information"
 *   fields={["email", "phone", "address"]}
 *   requiredFields={["email"]}
 *   defaultExpanded
 * >
 *   <FormField name="email" />
 *   <FormField name="phone" />
 *   <FormField name="address" />
 * </FormSection>
 * ```
 */
export function FormSection<T extends FieldValues = FieldValues>({
  fields = [],
  requiredFields = [],
  getCompletionStatus,
  showCompletionStatus = true,
  autoExpandOnError = false,
  isRequired = false,
  children,
  ...props
}: FormSectionProps<T>) {
  const form = useFormContext<T>();
  const { errors } = useFormState({ control: form.control });
  const values = form.watch();

  // Track previous error state for auto-expand
  const prevErrorCountRef = useRef(0);

  // Calculate completion status
  const completionStatus = useMemo(() => {
    if (!showCompletionStatus) return undefined;

    if (getCompletionStatus) {
      return getCompletionStatus(values as Partial<T>, errors);
    }

    if (fields.length === 0) return undefined;

    return getFieldsCompletionStatus(
      values as Record<string, unknown>,
      fields,
      requiredFields,
      errors
    );
  }, [showCompletionStatus, getCompletionStatus, values, fields, requiredFields, errors]);

  // Count errors in this section
  const errorCount = useMemo(() => {
    if (fields.length === 0) return 0;
    return countFieldErrors(fields, errors);
  }, [fields, errors]);

  // Auto-expand on error
  const [internalExpanded, setInternalExpanded] = useState(props.defaultExpanded ?? false);
  const isControlled = props.expanded !== undefined;

  useEffect(() => {
    if (autoExpandOnError && errorCount > 0 && prevErrorCountRef.current === 0) {
      // New errors appeared, expand section
      if (!isControlled) {
        setInternalExpanded(true);
      }
    }
    prevErrorCountRef.current = errorCount;
  }, [autoExpandOnError, errorCount, isControlled]);

  // Determine if section has required fields
  const hasRequiredFields = isRequired || requiredFields.length > 0;

  return (
    <CollapsibleSection
      {...props}
      completionStatus={completionStatus}
      errorCount={errorCount}
      hasRequiredFields={hasRequiredFields}
      expanded={isControlled ? props.expanded : internalExpanded}
      onExpandedChange={(expanded) => {
        if (!isControlled) {
          setInternalExpanded(expanded);
        }
        props.onExpandedChange?.(expanded);
      }}
    >
      {children}
    </CollapsibleSection>
  );
}

/**
 * Props for FormSectionSummary component
 */
export interface FormSectionSummaryProps {
  /** Sections to summarize */
  sections: Array<{
    id: string;
    title: string;
    required?: boolean;
  }>;
  /** Additional className */
  className?: string;
}

/**
 * A summary view of all form sections with their completion status
 */
export function FormSectionSummary({
  sections,
  className,
}: FormSectionSummaryProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Form Progress</span>
      </div>
      <div className="space-y-1">
        {sections.map((section) => (
          <div
            key={section.id}
            className="flex items-center gap-2 text-sm"
          >
            <div className="size-2 rounded-full bg-muted-foreground/30" />
            <span className="truncate">{section.title}</span>
            {section.required && (
              <Badge variant="outline" className="text-[10px] px-1">
                Required
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Props for FormSectionGroup component
 */
export interface FormSectionGroupProps {
  /** Form sections */
  children: ReactNode;
  /** Show expand/collapse all controls */
  showControls?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Context for form section group state
 */
const FormSectionGroupContext = createContext<{
  expandedSections: Set<string>;
  setExpandedSections: Dispatch<SetStateAction<Set<string>>>;
  sectionIds: string[];
  registerSection: (id: string) => void;
  unregisterSection: (id: string) => void;
} | null>(null);

/**
 * Hook to access form section group context
 */
export function useFormSectionGroup() {
  return useContext(FormSectionGroupContext);
}

/**
 * A group of form sections with coordinated state and controls
 */
export function FormSectionGroup({
  children,
  showControls = true,
  className,
}: FormSectionGroupProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sectionIds, setSectionIds] = useState<string[]>([]);

  const registerSection = useCallback((id: string) => {
    setSectionIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const unregisterSection = useCallback((id: string) => {
    setSectionIds((prev) => prev.filter((sid) => sid !== id));
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(new Set(sectionIds));
  }, [sectionIds]);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const allExpanded = sectionIds.length > 0 && expandedSections.size === sectionIds.length;

  const contextValue = useMemo(
    () => ({
      expandedSections,
      setExpandedSections,
      sectionIds,
      registerSection,
      unregisterSection,
    }),
    [expandedSections, sectionIds, registerSection, unregisterSection]
  );

  return (
    <FormSectionGroupContext.Provider value={contextValue}>
      <div className={className}>
        {showControls && sectionIds.length > 1 && (
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          </div>
        )}
        <div className="space-y-4">{children}</div>
      </div>
    </FormSectionGroupContext.Provider>
  );
}

export default FormSection;

/**
 * Accessibility Components and Hooks
 *
 * This module exports all accessibility-related components and hooks
 * for building WCAG 2.1 AA compliant interfaces.
 *
 * @see /accessibility for the accessibility statement
 */

// Layout components
export { SkipLink, SkipLinks } from "@/components/layout/skip-link";

// UI components
export { VisuallyHidden, SrOnly, visuallyHiddenClass } from "@/components/ui/visually-hidden";
export {
  LiveRegion,
  StatusMessage,
  LoadingAnnouncer,
  AlertAnnouncer,
  type LiveRegionPoliteness,
  type LiveRegionProps,
} from "@/components/ui/live-region";
export { FocusTrap } from "@/components/ui/focus-trap";
export {
  AccessibleButton,
  IconButton,
  ToggleButton,
  accessibleButtonVariants,
  type AccessibleButtonProps,
  type IconButtonProps,
  type ToggleButtonProps,
} from "@/components/ui/accessible-button";
export {
  AccessibleInput,
  AccessibleTextarea,
  AccessibleSelect,
  AccessibleCheckbox,
  Fieldset,
  type AccessibleInputProps,
  type AccessibleTextareaProps,
  type AccessibleSelectProps,
  type AccessibleCheckboxProps,
  type FieldsetProps,
} from "@/components/ui/accessible-form";
export { AccessibleDataTable } from "@/components/ui/accessible-data-table";
export {
  AccessibleDialog,
  AccessibleAlertDialog,
  AccessibleAnnouncement,
} from "@/components/ui/accessible-dialog";
export {
  KeyboardShortcutsGuide,
  KeyboardShortcutsTooltip,
} from "@/components/ui/keyboard-shortcuts-guide";

// Re-export hooks
export {
  useAnnouncer,
  Announcer,
  AnnouncerProvider,
  useGlobalAnnouncer,
  type Politeness,
} from "@/hooks/use-announcer";

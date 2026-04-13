"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export interface AccessibleDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Accessible title for the dialog */
  title: string;
  /** Accessible description for the dialog */
  description?: string;
  /** Dialog content */
  children: ReactNode;
  /** Size variant */
  size?: "sm" | "default" | "lg" | "xl" | "full";
  /** Whether to show close button */
  showClose?: boolean;
  /** Element to return focus to when dialog closes */
  initialFocus?: RefObject<HTMLElement>;
  /** Additional class name */
  className?: string;
}

const dialogSizeVariants = cva(
  "fixed z-50 grid w-full gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        default: "max-w-lg",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
        full: "max-w-[calc(100%-2rem)] h-[calc(100%-2rem)]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

/**
 * Accessible dialog component with focus trapping and keyboard support.
 *
 * @example
 * <AccessibleDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Confirm Action"
 *   description="Are you sure you want to proceed?"
 * >
 *   <Button onClick={handleConfirm}>Confirm</Button>
 * </AccessibleDialog>
 */
export function AccessibleDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "default",
  showClose = true,
  initialFocus,
  className,
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store previous focus and handle focus management
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the dialog or initial focus element
      const timer = setTimeout(() => {
        if (initialFocus?.current) {
          initialFocus.current.focus();
        } else {
          // Focus first focusable element in dialog
          const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          firstFocusable?.focus();
        }
      }, 0);

      return () => clearTimeout(timer);
    } else {
      // Return focus to previous element
      previousFocusRef.current?.focus();
    }
  }, [open, initialFocus]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (open && event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  // Focus trap
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    },
    []
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog content */}
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        className={cn(
          dialogSizeVariants({ size }),
          "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]",
          className
        )}
      >
        {/* Title */}
        <h2
          id={titleId}
          className="text-lg font-semibold leading-none tracking-tight"
        >
          {title}
        </h2>

        {/* Description */}
        {description && (
          <p
            id={descriptionId}
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}

        {/* Close button */}
        {showClose && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close dialog"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Content */}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export interface AccessibleAlertDialogProps extends AccessibleDialogProps {
  /** Variant affects the dialog's urgency */
  variant?: "default" | "destructive";
}

/**
 * Accessible alert dialog for confirmations and warnings.
 * Unlike regular dialogs, alert dialogs are more urgent and require user response.
 *
 * @example
 * <AccessibleAlertDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   title="Delete Item"
 *   description="This action cannot be undone."
 *   variant="destructive"
 * >
 *   <Button variant="destructive" onClick={handleDelete}>Delete</Button>
 *   <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
 * </AccessibleAlertDialog>
 */
export function AccessibleAlertDialog({
  variant = "default",
  ...props
}: AccessibleAlertDialogProps) {
  return (
    <AccessibleDialog
      {...props}
      className={cn(
        props.className,
        variant === "destructive" && "border-destructive/50"
      )}
    />
  );
}

export interface AccessibleAnnouncementProps {
  /** Announcement message */
  message: string;
  /** Whether to announce assertively */
  assertive?: boolean;
}

/**
 * Accessible announcement component for screen readers.
 *
 * @example
 * <AccessibleAnnouncement message="Form submitted successfully" />
 */
export function AccessibleAnnouncement({
  message,
  assertive = false,
}: AccessibleAnnouncementProps) {
  return (
    <div
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

export { AccessibleDialog as default };

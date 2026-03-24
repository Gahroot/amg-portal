"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FocusTrapProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether focus trapping is active */
  active?: boolean;
  /** Element to return focus to when trap is deactivated */
  returnFocusTo?: React.RefObject<HTMLElement>;
  /** Whether to autoFocus the first focusable element */
  autoFocus?: boolean;
  /** Callback when focus trap is activated */
  onActivate?: () => void;
  /** Callback when focus trap is deactivated */
  onDeactivate?: () => void;
}

/**
 * Focus trap component for modal dialogs and other focus-contained regions.
 * Ensures keyboard focus remains within the trapped region.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#focus_trapping
 *
 * @example
 * <FocusTrap active={isOpen}>
 *   <dialog role="dialog" aria-modal="true">
 *     <button>Focus stays here</button>
 *   </dialog>
 * </FocusTrap>
 */
export function FocusTrap({
  active = true,
  returnFocusTo,
  autoFocus = true,
  onActivate,
  onDeactivate,
  className,
  children,
  ...props
}: FocusTrapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Store the previously focused element
  React.useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      onActivate?.();

      // Auto-focus first focusable element
      if (autoFocus && containerRef.current) {
        const firstFocusable = getFirstFocusable(containerRef.current);
        (firstFocusable as HTMLElement | null)?.focus();
      }
    } else {
      onDeactivate?.();

      // Return focus to previous element or specified element
      const returnTo = returnFocusTo?.current || previousFocusRef.current;
      if (returnTo && typeof returnTo.focus === "function") {
        returnTo.focus();
      }
    }
  }, [active, autoFocus, onActivate, onDeactivate, returnFocusTo]);

  // Handle Tab key to trap focus
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (!active || event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          (lastElement as HTMLElement).focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          (firstElement as HTMLElement).focus();
        }
      }
    },
    [active]
  );

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={className}
      data-focus-trap={active ? "active" : "inactive"}
      {...props}
    >
      {children}
    </div>
  );
}

// Helper to get all focusable elements
function getFocusableElements(container: HTMLElement): Element[] {
  const selector = [
    'a[href]:not([disabled])',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(selector))
    .filter((el) => {
      // Check if element is visible
      const htmlEl = el as HTMLElement;
      return htmlEl.offsetParent !== null || 
             htmlEl.offsetWidth > 0 || 
             htmlEl.offsetHeight > 0;
    });
}

function getFirstFocusable(container: HTMLElement): Element | null {
  const elements = getFocusableElements(container);
  return elements.length > 0 ? elements[0] : null;
}

export { FocusTrap as default };

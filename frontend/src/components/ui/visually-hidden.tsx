"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

export interface VisuallyHiddenProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Use a different element via Radix Slot */
  asChild?: boolean;
}

/**
 * Visually hides content while keeping it accessible to screen readers.
 * Use this for labels, instructions, or other content that should be
 * announced but not displayed visually.
 *
 * @see https://www.w3.org/WAI/tutorials/forms/labels/#using-the-aria-label-attribute
 *
 * @example
 * // Icon-only button with accessible label
 * <button>
 *   <SearchIcon />
 *   <VisuallyHidden>Search</VisuallyHidden>
 * </button>
 *
 * @example
 * // Form field with hidden label
 * <div>
 *   <VisuallyHidden>
 *     <label htmlFor="email">Email address</label>
 *   </VisuallyHidden>
 *   <input id="email" type="email" placeholder="Email" />
 * </div>
 */
export function VisuallyHidden({
  className,
  asChild = false,
  children,
  ...props
}: VisuallyHiddenProps) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      className={cn(
        // Position off-screen but keep accessible
        "absolute overflow-hidden",
        // 1px dimensions to maintain focus ring visibility in some browsers
        "h-px w-px",
        // Hide from visual rendering
        "border-0 p-0",
        // Clip to hide completely
        "[clip:rect(0,0,0,0)]",
        // Prevent whitespace issues
        "whitespace-nowrap",
        // Keep in accessibility tree
        "[clip-path:inset(50%)]",
        // Ensure it's not visible but still in focus order when containing focusable
        "not-sr-only",
        className
      )}
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        borderWidth: 0,
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

/**
 * CSS class for visually hiding content.
 * Use this when you need to apply visual hiding via className instead of component.
 */
export const visuallyHiddenClass =
  "absolute h-px w-px overflow-hidden border-0 p-0 [clip:rect(0,0,0,0)] [clip-path:inset(50%)] whitespace-nowrap not-sr-only";

/**
 * Screen reader only text - alias for VisuallyHidden for common use case.
 * @example
 * <SrOnly>Loading...</SrOnly>
 */
export const SrOnly = VisuallyHidden;

export { VisuallyHidden as default };

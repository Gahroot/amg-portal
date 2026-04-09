"use client";

import { useCallback } from "react";
import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface SkipLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** The target element ID to skip to (without #) */
  targetId: string;
  /** Label for the skip link */
  label: string;
  /** Position offset when multiple skip links are stacked */
  positionOffset?: number;
}

/**
 * Skip link for keyboard navigation accessibility.
 * Allows keyboard users to bypass repetitive content and navigate directly to main content areas.
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html
 *
 * @example
 * <SkipLink targetId="main-content" label="Skip to main content" />
 * <main id="main-content">...</main>
 */
export function SkipLink({
  targetId,
  label,
  positionOffset = 0,
  className,
  ...props
}: SkipLinkProps) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        // Set tabindex to make the element focusable if it isn't already
        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }
        target.focus();
        // Scroll to the target
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [targetId]
  );

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // Visually hidden until focused
        "sr-only focus:not-sr-only",
        // When focused, display as a visible button
        "focus:absolute focus:z-[9999] focus:box-border",
        "focus:left-4 focus:top-4",
        "focus:inline-flex focus:items-center focus:justify-center",
        "focus:rounded-md focus:px-4 focus:py-3",
        "focus:bg-background focus:text-foreground",
        "focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "focus:shadow-lg focus:border-2 focus:border-primary",
        "focus:font-medium focus:text-sm",
        "focus:outline-none",
        // Transition for smooth appearance
        "transition-all duration-200",
        // Support for stacked skip links
        positionOffset > 0 && `focus:mt-[${positionOffset * 3}rem]`,
        className
      )}
      style={
        positionOffset > 0
          ? { top: `calc(1rem + ${positionOffset * 3}rem)` }
          : undefined
      }
      {...props}
    >
      {label}
    </a>
  );
}

interface SkipLinksProps {
  /** Additional skip links to render */
  links?: Array<{ targetId: string; label: string }>;
  /** Additional class names */
  className?: string;
}

/**
 * Container for multiple skip links.
 * Provides standard skip links for main content and navigation,
 * plus any additional custom skip links.
 *
 * @example
 * <SkipLinks links={[{ targetId: "search", label: "Skip to search" }]} />
 */
export function SkipLinks({ links = [], className }: SkipLinksProps) {
  const defaultLinks = [
    { targetId: "main-content", label: "Skip to main content" },
    { targetId: "sidebar-navigation", label: "Skip to navigation" },
  ];

  const allLinks = [...defaultLinks, ...links];

  return (
    <nav
      aria-label="Skip links"
      className={cn("skip-links", className)}
      data-slot="skip-links"
    >
      {allLinks.map((link, index) => (
        <SkipLink
          key={link.targetId}
          targetId={link.targetId}
          label={link.label}
          positionOffset={index}
        />
      ))}
    </nav>
  );
}

export { SkipLink as default };

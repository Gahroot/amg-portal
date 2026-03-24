"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label for screen readers (required if only icon is visible) */
  "aria-label"?: string;
  /** Described by this element ID */
  "aria-describedby"?: string;
  /** Expanded state for buttons that control collapsible content */
  "aria-expanded"?: boolean;
  /** Controls element ID for buttons that control other elements */
  "aria-controls"?: string;
  /** Pressed state for toggle buttons */
  "aria-pressed"?: boolean;
  /** Whether this button is a toggle button */
  "aria-haspopup"?: boolean | "menu" | "listbox" | "tree" | "grid" | "dialog";
  /** Loading state */
  loading?: boolean;
  /** Icon-only mode (requires aria-label) */
  iconOnly?: boolean;
}

const accessibleButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Accessible button component with built-in ARIA support.
 * Use this for buttons that need enhanced accessibility features.
 *
 * @example
 * // Icon button with accessible label
 * <AccessibleButton variant="ghost" size="icon" aria-label="Search" iconOnly>
 *   <SearchIcon />
 * </AccessibleButton>
 *
 * @example
 * // Toggle button
 * <AccessibleButton aria-pressed={isActive} onClick={toggle}>
 *   {isActive ? "Active" : "Inactive"}
 * </AccessibleButton>
 *
 * @example
 * // Loading state
 * <AccessibleButton loading disabled={loading}>
 *   <Spinner /> Saving...
 * </AccessibleButton>
 */
export const AccessibleButton = React.forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps & VariantProps<typeof accessibleButtonVariants>
>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      iconOnly = false,
      disabled,
      children,
      "aria-label": ariaLabel,
      "aria-expanded": ariaExpanded,
      "aria-controls": ariaControls,
      "aria-pressed": ariaPressed,
      "aria-haspopup": ariaHasPopup,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    // Ensure icon-only buttons have accessible labels
    if (iconOnly && !ariaLabel) {
      console.warn(
        "AccessibleButton: iconOnly buttons require an aria-label prop"
      );
    }

    return (
      <button
        ref={ref}
        className={cn(accessibleButtonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-pressed={ariaPressed}
        aria-haspopup={ariaHasPopup}
        aria-describedby={ariaDescribedBy}
        aria-busy={loading}
        data-loading={loading}
        {...props}
      >
        {loading && (
          <span className="animate-spin h-4 w-4" aria-hidden="true">
            ◌
          </span>
        )}
        {children}
      </button>
    );
  }
);

AccessibleButton.displayName = "AccessibleButton";

export interface IconButtonProps
  extends Omit<AccessibleButtonProps, "iconOnly"> {
  /** Icon element */
  icon: React.ReactNode;
  /** Accessible label (required) */
  label: string;
  /** Show tooltip on hover */
  showTooltip?: boolean;
}

/**
 * Icon-only button with built-in accessibility.
 * Automatically adds aria-label and screen reader text.
 *
 * @example
 * <IconButton icon={<SearchIcon />} label="Search" onClick={handleSearch} />
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, className, ...props }, ref) => {
    return (
      <AccessibleButton
        ref={ref}
        aria-label={label}
        iconOnly
        className={cn("p-2", className)}
        {...props}
      >
        {icon}
        <span className="sr-only">{label}</span>
      </AccessibleButton>
    );
  }
);

IconButton.displayName = "IconButton";

export interface ToggleButtonProps
  extends Omit<AccessibleButtonProps, "aria-pressed"> {
  /** Whether the button is toggled on */
  pressed: boolean;
  /** Callback when toggled */
  onPressedChange: (pressed: boolean) => void;
  /** Label for the "on" state */
  labelOn?: string;
  /** Label for the "off" state */
  labelOff?: string;
}

/**
 * Toggle button with proper ARIA pressed state.
 *
 * @example
 * <ToggleButton
 *   pressed={isBookmarked}
 *   onPressedChange={setIsBookmarked}
 *   labelOn="Remove bookmark"
 *   labelOff="Add bookmark"
 * >
 *   <BookmarkIcon filled={isBookmarked} />
 * </ToggleButton>
 */
export const ToggleButton = React.forwardRef<
  HTMLButtonElement,
  ToggleButtonProps & VariantProps<typeof accessibleButtonVariants>
>(
  (
    {
      pressed,
      onPressedChange,
      labelOn,
      labelOff,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onPressedChange(!pressed);
      onClick?.(e);
    };

    const ariaLabel = pressed && labelOn ? labelOn : !pressed && labelOff ? labelOff : undefined;

    return (
      <AccessibleButton
        ref={ref}
        aria-pressed={pressed}
        aria-label={ariaLabel}
        onClick={handleClick}
        {...props}
      >
        {children}
      </AccessibleButton>
    );
  }
);

ToggleButton.displayName = "ToggleButton";

export { accessibleButtonVariants };

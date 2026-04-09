"use client";

import type { ComponentProps, ReactNode } from "react";
import { HelpCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Props for the HelpTooltip component
 */
export interface HelpTooltipProps {
  /** The help content to display in the tooltip */
  content: ReactNode;
  /** Icon variant to use */
  variant?: "default" | "info" | "muted";
  /** Size of the icon */
  size?: "sm" | "md" | "lg";
  /** Side to show the tooltip */
  side?: "top" | "right" | "bottom" | "left";
  /** Additional class names for the icon */
  iconClassName?: string;
  /** Additional class names for the tooltip content */
  contentClassName?: string;
  /** Delay before showing tooltip in ms */
  delayDuration?: number;
  /** Whether to show an interactive tooltip (stays open on hover) */
  interactive?: boolean;
}

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const iconVariants = {
  default: "text-muted-foreground hover:text-foreground cursor-help transition-colors",
  info: "text-primary/70 hover:text-primary cursor-help transition-colors",
  muted: "text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors",
};

/**
 * A tooltip component that shows help information on hover/focus.
 * Displays a help icon that indicates help is available.
 *
 * @example
 * ```tsx
 * <HelpTooltip content="Enter your full legal name as it appears on official documents.">
 *   <Label>Full Name</Label>
 * </HelpTooltip>
 * ```
 *
 * @example
 * // With rich content
 * ```tsx
 * <HelpTooltip
 *   content={
 *     <div>
 *       <p className="font-medium">Password Requirements:</p>
 *       <ul className="list-disc pl-4 mt-1">
 *         <li>At least 8 characters</li>
 *         <li>One uppercase letter</li>
 *         <li>One number</li>
 *       </ul>
 *     </div>
 *   }
 * >
 *   Password
 * </HelpTooltip>
 * ```
 */
export function HelpTooltip({
  content,
  variant = "default",
  size = "md",
  side = "top",
  iconClassName,
  contentClassName,
  delayDuration = 300,
  interactive = false,
}: HelpTooltipProps) {
  const Icon = variant === "info" ? Info : HelpCircle;

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-center",
            iconVariants[variant],
            iconClassName
          )}
          tabIndex={0}
          aria-label="Help"
          onKeyDown={(e) => {
            // Allow keyboard activation
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
        >
          <Icon className={iconSizes[size]} aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={4}
        className={cn(
          "max-w-xs text-xs",
          interactive && "pointer-events-auto",
          contentClassName
        )}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Props for HelpTooltipWrapper component
 */
export interface HelpTooltipWrapperProps extends HelpTooltipProps {
  /** The element to wrap with the help tooltip */
  children: ReactNode;
  /** Position of the help icon relative to children */
  position?: "start" | "end";
  /** Gap between children and icon */
  gap?: "xs" | "sm" | "md";
}

const gapSizes = {
  xs: "gap-0.5",
  sm: "gap-1",
  md: "gap-2",
};

/**
 * Wraps children with a help tooltip, placing the help icon next to them.
 *
 * @example
 * ```tsx
 * <HelpTooltipWrapper content="This field is required for all submissions.">
 *   <Label>Reference Number</Label>
 * </HelpTooltipWrapper>
 * ```
 */
export function HelpTooltipWrapper({
  children,
  content,
  position = "end",
  gap = "sm",
  ...tooltipProps
}: HelpTooltipWrapperProps) {
  return (
    <span className={cn("inline-flex items-center", gapSizes[gap])}>
      {position === "start" && <HelpTooltip content={content} {...tooltipProps} />}
      {children}
      {position === "end" && <HelpTooltip content={content} {...tooltipProps} />}
    </span>
  );
}

/**
 * Props for FormLabelWithHelp component
 */
export interface FormLabelWithHelpProps extends ComponentProps<"label"> {
  /** The label text */
  label: string;
  /** Help content for the tooltip */
  helpContent: ReactNode;
  /** Whether the field is required */
  required?: boolean;
  /** Tooltip props to pass through */
  tooltipProps?: Partial<HelpTooltipProps>;
}

/**
 * A form label with an integrated help tooltip.
 *
 * @example
 * ```tsx
 * <FormLabelWithHelp
 *   label="Email Address"
 *   helpContent="We'll use this to send you notifications and updates."
 *   required
 * />
 * ```
 */
export function FormLabelWithHelp({
  label,
  helpContent,
  required,
  className,
  tooltipProps,
  ..._props
}: FormLabelWithHelpProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium leading-none", className)}>
      <span className={cn(required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
        {label}
      </span>
      <HelpTooltip content={helpContent} size="sm" {...tooltipProps} />
    </span>
  );
}

export default HelpTooltip;

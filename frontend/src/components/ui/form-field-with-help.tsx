"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  HelpTooltip,
  type HelpTooltipProps,
} from "@/components/ui/help-tooltip";

/**
 * Common props for form fields with help
 */
interface FormFieldWithHelpBaseProps {
  /** Field label */
  label: string;
  /** Help content - can be string or React node for rich content */
  helpContent?: React.ReactNode;
  /** Props to pass to the help tooltip */
  tooltipProps?: Partial<HelpTooltipProps>;
  /** Error message to display */
  error?: string;
  /** Helper text displayed below the field */
  helperText?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether to visually hide the label */
  hideLabel?: boolean;
  /** Additional class name */
  className?: string;
  /** Field ID */
  id?: string;
}

/**
 * Props for InputWithHelp component
 */
export interface InputWithHelpProps
  extends FormFieldWithHelpBaseProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "label"> {}

/**
 * An input field with integrated label, help tooltip, and error display.
 *
 * @example
 * ```tsx
 * <InputWithHelp
 *   label="Email Address"
 *   helpContent="We'll use this for account notifications and password recovery."
 *   placeholder="you@example.com"
 *   required
 *   error={errors.email}
 * />
 * ```
 */
export const InputWithHelp = React.forwardRef<HTMLInputElement, InputWithHelpProps>(
  (
    {
      label,
      helpContent,
      tooltipProps,
      error,
      helperText,
      required,
      hideLabel,
      className,
      id,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const describedBy = [
      error ? errorId : null,
      helperText && !error ? helperId : null,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={cn("grid gap-1.5", className)}>
        <div className="flex items-center gap-1.5">
          <Label
            htmlFor={inputId}
            className={cn(
              "text-sm font-medium leading-none",
              hideLabel && "sr-only",
              error && "text-destructive"
            )}
          >
            {label}
            {required && (
              <span className="text-destructive ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </Label>
          {helpContent && <HelpTooltip content={helpContent} size="sm" {...tooltipProps} />}
        </div>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={describedBy || undefined}
          required={required}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-sm text-destructive"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

InputWithHelp.displayName = "InputWithHelp";

/**
 * Props for TextareaWithHelp component
 */
export interface TextareaWithHelpProps
  extends FormFieldWithHelpBaseProps,
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "label"> {}

/**
 * A textarea field with integrated label, help tooltip, and error display.
 *
 * @example
 * ```tsx
 * <TextareaWithHelp
 *   label="Description"
 *   helpContent={{
 *     title: "Description Guidelines",
 *     body: "Provide a brief summary of the purpose and scope."
 *   }}
 *   maxLength={500}
 *   showCount
 * />
 * ```
 */
export const TextareaWithHelp = React.forwardRef<HTMLTextAreaElement, TextareaWithHelpProps>(
  (
    {
      label,
      helpContent,
      tooltipProps,
      error,
      helperText,
      required,
      hideLabel,
      className,
      id,
      maxLength,
      value,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;
    const countId = `${textareaId}-count`;

    const currentLength =
      typeof value === "string"
        ? value.length
        : typeof props.defaultValue === "string"
          ? props.defaultValue.length
          : 0;

    const describedBy = [
      error ? errorId : null,
      helperText && !error ? helperId : null,
      maxLength ? countId : null,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={cn("grid gap-1.5", className)}>
        <div className="flex items-center gap-1.5">
          <Label
            htmlFor={textareaId}
            className={cn(
              "text-sm font-medium leading-none",
              hideLabel && "sr-only",
              error && "text-destructive"
            )}
          >
            {label}
            {required && (
              <span className="text-destructive ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </Label>
          {helpContent && <HelpTooltip content={helpContent} size="sm" {...tooltipProps} />}
        </div>
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={describedBy || undefined}
          required={required}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          {...props}
        />
        <div className="flex justify-between">
          <div>
            {error && (
              <p
                id={errorId}
                role="alert"
                className="text-sm text-destructive"
                aria-live="polite"
              >
                {error}
              </p>
            )}
            {helperText && !error && (
              <p id={helperId} className="text-sm text-muted-foreground">
                {helperText}
              </p>
            )}
          </div>
          {maxLength && (
            <p
              id={countId}
              className="text-sm text-muted-foreground"
              aria-live="off"
            >
              {currentLength}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

TextareaWithHelp.displayName = "TextareaWithHelp";

/**
 * Props for SelectWithHelp component
 */
export interface SelectWithHelpProps extends FormFieldWithHelpBaseProps {
  /** The select trigger element */
  children: React.ReactNode;
}

/**
 * A wrapper for select components with integrated label and help tooltip.
 *
 * @example
 * ```tsx
 * <SelectWithHelp
 *   label="Priority"
 *   helpContent="Higher priority items are processed first in the queue."
 *   error={errors.priority}
 * >
 *   <Select value={value} onValueChange={setValue}>
 *     <SelectTrigger>
 *       <SelectValue placeholder="Select priority" />
 *     </SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="low">Low</SelectItem>
 *       <SelectItem value="medium">Medium</SelectItem>
 *       <SelectItem value="high">High</SelectItem>
 *     </SelectContent>
 *   </Select>
 * </SelectWithHelp>
 * ```
 */
export const SelectWithHelp = React.forwardRef<HTMLDivElement, SelectWithHelpProps>(
  (
    {
      label,
      helpContent,
      tooltipProps,
      error,
      helperText,
      required,
      hideLabel,
      className,
      id,
      children,
    },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    return (
      <div ref={ref} className={cn("grid gap-1.5", className)}>
        <div className="flex items-center gap-1.5">
          <Label
            htmlFor={selectId}
            className={cn(
              "text-sm font-medium leading-none",
              hideLabel && "sr-only",
              error && "text-destructive"
            )}
          >
            {label}
            {required && (
              <span className="text-destructive ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </Label>
          {helpContent && <HelpTooltip content={helpContent} size="sm" {...tooltipProps} />}
        </div>
        {React.cloneElement(children as React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-required"?: boolean }>, {
          id: selectId,
          "aria-invalid": !!error,
          "aria-required": required,
        })}
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-sm text-destructive"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

SelectWithHelp.displayName = "SelectWithHelp";

/**
 * Props for CheckboxWithHelp component
 */
export interface CheckboxWithHelpProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "label"> {
  /** Checkbox label */
  label: string;
  /** Help content for tooltip */
  helpContent?: React.ReactNode;
  /** Tooltip props */
  tooltipProps?: Partial<HelpTooltipProps>;
  /** Error message */
  error?: string;
  /** Helper text below checkbox */
  helperText?: string;
}

/**
 * A checkbox with integrated label and help tooltip.
 *
 * @example
 * ```tsx
 * <CheckboxWithHelp
 *   label="Enable notifications"
 *   helpContent="Receive email notifications when your requests are updated."
 *   checked={enabled}
 *   onCheckedChange={setEnabled}
 * />
 * ```
 */
export const CheckboxWithHelp = React.forwardRef<HTMLInputElement, CheckboxWithHelpProps>(
  (
    {
      label,
      helpContent,
      tooltipProps,
      error,
      helperText,
      className,
      id,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;
    const errorId = `${checkboxId}-error`;
    const helperId = `${checkboxId}-helper`;

    const describedBy = [
      error ? errorId : null,
      helperText && !error ? helperId : null,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={cn("flex items-start gap-2", className)}>
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-4 w-4 shrink-0 rounded-sm border border-primary",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive"
          )}
          {...props}
        />
        <div className="grid gap-1">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={checkboxId}
              className={cn(
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                error && "text-destructive"
              )}
            >
              {label}
            </label>
            {helpContent && <HelpTooltip content={helpContent} size="sm" {...tooltipProps} />}
          </div>
          {error && (
            <p
              id={errorId}
              role="alert"
              className="text-sm text-destructive"
              aria-live="polite"
            >
              {error}
            </p>
          )}
          {helperText && !error && (
            <p id={helperId} className="text-sm text-muted-foreground">
              {helperText}
            </p>
          )}
        </div>
      </div>
    );
  }
);

CheckboxWithHelp.displayName = "CheckboxWithHelp";

/**
 * Props for FieldHelpContent - structured help content
 */
export interface FieldHelpContent {
  /** Optional title for the help tooltip */
  title?: string;
  /** Main help text */
  body: string;
  /** Optional list of items */
  items?: string[];
  /** Optional link to documentation */
  link?: {
    href: string;
    label: string;
  };
}

/**
 * Renders structured help content for tooltips.
 *
 * @example
 * ```tsx
 * <HelpTooltip content={<FieldHelpContent {...passwordHelpContent} />}>
 *   <Label>Password</Label>
 * </HelpTooltip>
 * ```
 */
export function renderFieldHelpContent(content: FieldHelpContent) {
  return (
    <div className="space-y-2">
      {content.title && (
        <p className="font-medium text-foreground">{content.title}</p>
      )}
      <p>{content.body}</p>
      {content.items && content.items.length > 0 && (
        <ul className="list-disc pl-4 space-y-0.5">
          {content.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
      {content.link && (
        <a
          href={content.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-primary hover:underline"
        >
          {content.link.label}
        </a>
      )}
    </div>
  );
}

export {
  InputWithHelp as Input,
  TextareaWithHelp as Textarea,
  SelectWithHelp as Select,
  CheckboxWithHelp as Checkbox,
};

"use client";

import { FieldsetHTMLAttributes, useId } from "react";
import type { InputHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface AccessibleInputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  /** Label text (required for accessibility) */
  label: string;
  /** Whether to visually hide the label */
  hideLabel?: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required field indicator */
  required?: boolean;
}

/**
 * Accessible input component with built-in label, error, and helper text associations.
 * Automatically connects label, input, error, and helper text via ARIA.
 *
 * @example
 * <AccessibleInput
 *   label="Email"
 *   type="email"
 *   error={errors.email}
 *   helperText="We'll never share your email"
 *   required
 * />
 */
export function AccessibleInput({
  ref,
  label,
  hideLabel = false,
  error,
  helperText,
  required,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: AccessibleInputProps & { ref?: Ref<HTMLInputElement> }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  // Build aria-describedby
  const describedBy = [
    error ? errorId : null,
    helperText && !error ? helperId : null,
    ariaDescribedBy,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "text-sm font-medium leading-none",
          hideLabel && "sr-only",
          error && "text-destructive"
        )}
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
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

export interface AccessibleTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label text (required for accessibility) */
  label: string;
  /** Whether to visually hide the label */
  hideLabel?: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required field indicator */
  required?: boolean;
  /** Max character count */
  maxLength?: number;
  /** Show character count */
  showCount?: boolean;
}

/**
 * Accessible textarea component with built-in label, error, and helper text.
 *
 * @example
 * <AccessibleTextarea
 *   label="Message"
 *   error={errors.message}
 *   maxLength={500}
 *   showCount
 * />
 */
export function AccessibleTextarea({
  ref,
  label,
  hideLabel = false,
  error,
  helperText,
  required,
  maxLength,
  showCount,
  className,
  id,
  value,
  "aria-describedby": ariaDescribedBy,
  ...props
}: AccessibleTextareaProps & { ref?: Ref<HTMLTextAreaElement> }) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;
  const countId = `${textareaId}-count`;

  const currentLength =
    typeof value === "string" ? value.length : (typeof props.defaultValue === "string" ? props.defaultValue.length : 0);

  // Build aria-describedby
  const describedBy = [
    error ? errorId : null,
    helperText && !error ? helperId : null,
    showCount ? countId : null,
    ariaDescribedBy,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label
        htmlFor={textareaId}
        className={cn(
          "text-sm font-medium leading-none",
          hideLabel && "sr-only",
          error && "text-destructive"
        )}
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
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
        {showCount && maxLength && (
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

export interface AccessibleSelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Label text (required for accessibility) */
  label: string;
  /** Whether to visually hide the label */
  hideLabel?: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required field indicator */
  required?: boolean;
  /** Options for the select */
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Accessible select component with built-in label and error handling.
 *
 * @example
 * <AccessibleSelect
 *   label="Country"
 *   options={countries}
 *   error={errors.country}
 *   required
 * />
 */
export function AccessibleSelect({
  ref,
  label,
  hideLabel = false,
  error,
  helperText,
  required,
  options,
  placeholder,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: AccessibleSelectProps & { ref?: Ref<HTMLSelectElement> }) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  // Build aria-describedby
  const describedBy = [
    error ? errorId : null,
    helperText && !error ? helperId : null,
    ariaDescribedBy,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label
        htmlFor={selectId}
        className={cn(
          "text-sm font-medium leading-none",
          hideLabel && "sr-only",
          error && "text-destructive"
        )}
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={describedBy || undefined}
        required={required}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive"
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
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

export interface AccessibleCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Label text (required for accessibility) */
  label: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
}

/**
 * Accessible checkbox with proper label association.
 *
 * @example
 * <AccessibleCheckbox
 *   label="I agree to the terms and conditions"
 *   checked={agreed}
 *   onCheckedChange={setAgreed}
 * />
 */
export function AccessibleCheckbox({
  ref,
  label,
  error,
  helperText,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: AccessibleCheckboxProps & { ref?: Ref<HTMLInputElement> }) {
  const generatedId = useId();
  const checkboxId = id || generatedId;
  const errorId = `${checkboxId}-error`;
  const helperId = `${checkboxId}-helper`;

  // Build aria-describedby
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
        <label
          htmlFor={checkboxId}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error && "text-destructive"
          )}
        >
          {label}
        </label>
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

export interface FieldsetProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  /** Legend text (required for accessibility) */
  legend: string;
  /** Whether to visually hide the legend */
  hideLegend?: boolean;
}

/**
 * Accessible fieldset with legend.
 *
 * @example
 * <Fieldset legend="Personal Information">
 *   <AccessibleInput label="First Name" />
 *   <AccessibleInput label="Last Name" />
 * </Fieldset>
 */
export function Fieldset({
  ref,
  legend,
  hideLegend = false,
  className,
  children,
  ...props
}: FieldsetProps & { ref?: Ref<HTMLFieldSetElement> }) {
  return (
    <fieldset
      ref={ref}
      className={cn("space-y-4", className)}
      {...props}
    >
      <legend className={cn("text-sm font-medium", hideLegend && "sr-only")}>
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

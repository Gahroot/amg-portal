"use client";

import * as React from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useFieldValidation,
  type ValidationRule,
  type ValidationMode,
  type FieldValidationState,
} from "@/hooks/use-field-validation";

/**
 * Full validation return type including methods
 */
export interface FieldValidationReturn extends FieldValidationState {
  /** Current field value */
  value: unknown;
  /** Handle value change */
  onChange: (value: unknown) => void;
  /** Handle blur */
  onBlur: () => void;
  /** Manually trigger validation */
  validate: () => Promise<boolean>;
  /** Reset field to initial state */
  reset: () => void;
  /** Clear error message */
  clearError: () => void;
  /** Set error manually */
  setError: (error: string | null) => void;
}

/**
 * Props for ValidatedInput component
 */
export interface ValidatedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "value"> {
  /** Label text */
  label: string;
  /** Whether to visually hide the label */
  hideLabel?: boolean;
  /** Validation rules to apply */
  rules?: ValidationRule;
  /** Validation mode */
  validationMode?: ValidationMode;
  /** Debounce delay in ms for onChange validation */
  debounceMs?: number;
  /** Helper text shown below the input */
  helperText?: string;
  /** Show check mark when valid */
  showValidMark?: boolean;
  /** Show loading spinner during async validation */
  showLoadingSpinner?: boolean;
  /** Custom error message override */
  error?: string;
  /** Callback when validation state changes */
  onValidationChange?: (state: FieldValidationState) => void;
  /** Controlled value */
  value?: string;
  /** Default value for uncontrolled mode */
  defaultValue?: string;
  /** Change handler */
  onChange?: (value: string, state: FieldValidationReturn) => void;
  /** Blur handler */
  onBlur?: (state: FieldValidationReturn) => void;
}

/**
 * Input component with built-in real-time validation and visual feedback.
 *
 * @example
 * ```tsx
 * <ValidatedInput
 *   label="Email"
 *   type="email"
 *   rules={{ required: true, email: true }}
 *   validationMode="onChange"
 *   showValidMark
 * />
 * ```
 */
export function ValidatedInput({
  ref,
  label,
  hideLabel = false,
  rules,
  validationMode = "onBlur",
  debounceMs = 300,
  helperText,
  showValidMark = false,
  showLoadingSpinner = true,
  error: externalError,
  onValidationChange,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onBlur,
  className,
  id,
  required,
  disabled,
  ...props
}: ValidatedInputProps & { ref?: React.Ref<HTMLInputElement> }) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const isControlled = controlledValue !== undefined;

  const validation = useFieldValidation({
    rules,
    mode: validationMode,
    debounceMs,
    initialValue: isControlled ? controlledValue : defaultValue,
    onValidationChange,
  });

  // Cast validation to include methods
  const validationReturn = validation as FieldValidationReturn;

  // Sync controlled value
  React.useEffect(() => {
    if (isControlled && controlledValue !== validation.value) {
      validation.onChange(controlledValue);
    }
  }, [controlledValue, isControlled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    validation.onChange(newValue);
    onChange?.(newValue, validationReturn);
  };

  const handleBlur = () => {
    validation.onBlur();
    onBlur?.(validationReturn);
  };

  // Use external error if provided, otherwise use validation error
  const displayError = externalError ?? (validation.isTouched ? validation.error : null);
  const hasError = displayError !== null;
  const isValid = validation.isValid && validation.isTouched && !hasError;

  // Build aria-describedby
  const describedBy = [
    hasError ? errorId : null,
    helperText && !hasError ? helperId : null,
    props["aria-describedby"],
  ]
    .filter(Boolean)
    .join(" ");

  // Determine icon to show
  const showCheckIcon = showValidMark && isValid && !validation.isValidating;
  const showErrorIcon = hasError && !validation.isValidating;
  const showSpinner = showLoadingSpinner && validation.isValidating;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label
        htmlFor={inputId}
        className={cn(
          hideLabel && "sr-only",
          hasError && "text-destructive"
        )}
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          value={isControlled ? controlledValue : (validation.value as string)}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={hasError}
          aria-describedby={describedBy || undefined}
          required={required}
          disabled={disabled}
          className={cn(
            hasError && "border-destructive focus-visible:ring-destructive/50",
            isValid && "border-green-600 focus-visible:ring-green-600/50",
            (showCheckIcon || showErrorIcon || showSpinner) && "pr-10"
          )}
          {...props}
        />
        {/* Status icons */}
        {(showCheckIcon || showErrorIcon || showSpinner) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {showSpinner && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {showCheckIcon && (
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
            {showErrorIcon && (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
      {/* Error message */}
      {hasError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-destructive"
          aria-live="polite"
        >
          {displayError}
        </p>
      )}
      {/* Helper text */}
      {helperText && !hasError && (
        <p id={helperId} className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  );
}

/**
 * Props for ValidatedTextarea component
 */
export interface ValidatedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "onBlur" | "value"> {
  /** Label text */
  label: string;
  /** Whether to visually hide the label */
  hideLabel?: boolean;
  /** Validation rules to apply */
  rules?: ValidationRule;
  /** Validation mode */
  validationMode?: ValidationMode;
  /** Debounce delay in ms for onChange validation */
  debounceMs?: number;
  /** Helper text shown below the textarea */
  helperText?: string;
  /** Show character count */
  showCount?: boolean;
  /** Custom error message override */
  error?: string;
  /** Callback when validation state changes */
  onValidationChange?: (state: FieldValidationState) => void;
  /** Controlled value */
  value?: string;
  /** Default value for uncontrolled mode */
  defaultValue?: string;
  /** Change handler */
  onChange?: (value: string, state: FieldValidationReturn) => void;
  /** Blur handler */
  onBlur?: (state: FieldValidationReturn) => void;
}

/**
 * Textarea component with built-in real-time validation and visual feedback.
 *
 * @example
 * ```tsx
 * <ValidatedTextarea
 *   label="Bio"
 *   rules={{ maxLength: { value: 500, message: "Bio must be under 500 characters" } }}
 *   showCount
 *   maxLength={500}
 * />
 * ```
 */
export function ValidatedTextarea({
  ref,
  label,
  hideLabel = false,
  rules,
  validationMode = "onBlur",
  debounceMs = 300,
  helperText,
  showCount = false,
  error: externalError,
  onValidationChange,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onBlur,
  className,
  id,
  required,
  disabled,
  maxLength,
  ...props
}: ValidatedTextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
  const generatedId = React.useId();
  const textareaId = id || generatedId;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;
  const countId = `${textareaId}-count`;

  const isControlled = controlledValue !== undefined;

  const validation = useFieldValidation({
    rules,
    mode: validationMode,
    debounceMs,
    initialValue: isControlled ? controlledValue : defaultValue,
    onValidationChange,
  });

  // Cast validation to include methods
  const validationReturn = validation as FieldValidationReturn;

  // Sync controlled value
  React.useEffect(() => {
    if (isControlled && controlledValue !== validation.value) {
      validation.onChange(controlledValue);
    }
  }, [controlledValue, isControlled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    validation.onChange(newValue);
    onChange?.(newValue, validationReturn);
  };

  const handleBlur = () => {
    validation.onBlur();
    onBlur?.(validationReturn);
  };

  const currentValue = isControlled ? controlledValue : (validation.value as string);
  const currentLength = typeof currentValue === "string" ? currentValue.length : 0;

  // Use external error if provided, otherwise use validation error
  const displayError = externalError ?? (validation.isTouched ? validation.error : null);
  const hasError = displayError !== null;

  // Build aria-describedby
  const describedBy = [
    hasError ? errorId : null,
    helperText && !hasError ? helperId : null,
    showCount ? countId : null,
    props["aria-describedby"],
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid gap-2", className)}>
      <Label
        htmlFor={textareaId}
        className={cn(
          hideLabel && "sr-only",
          hasError && "text-destructive"
        )}
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <textarea
        ref={ref}
        id={textareaId}
        value={currentValue}
        maxLength={maxLength}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={hasError}
        aria-describedby={describedBy || undefined}
        required={required}
        disabled={disabled}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          hasError && "border-destructive focus-visible:ring-destructive/50"
        )}
        {...props}
      />
      <div className="flex justify-between">
        <div>
          {hasError && (
            <p
              id={errorId}
              role="alert"
              className="text-sm text-destructive"
              aria-live="polite"
            >
              {displayError}
            </p>
          )}
          {helperText && !hasError && (
            <p id={helperId} className="text-sm text-muted-foreground">
              {helperText}
            </p>
          )}
        </div>
        {showCount && maxLength && (
          <p
            id={countId}
            className={cn(
              "text-sm text-muted-foreground",
              currentLength > maxLength && "text-destructive"
            )}
            aria-live="off"
          >
            {currentLength}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Predefined validation rules for common use cases
 */
export const commonValidationRules = {
  email: {
    required: "Email is required",
    email: "Please enter a valid email address",
  } as ValidationRule,

  password: {
    required: "Password is required",
    minLength: { value: 8, message: "Password must be at least 8 characters" },
    pattern: {
      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      message: "Password must contain uppercase, lowercase, and a number",
    },
  } as ValidationRule,

  phone: {
    required: "Phone number is required",
    phone: "Please enter a valid phone number",
  } as ValidationRule,

  url: {
    url: "Please enter a valid URL",
  } as ValidationRule,

  required: {
    required: "This field is required",
  } as ValidationRule,

  name: {
    required: "Name is required",
    minLength: { value: 2, message: "Name must be at least 2 characters" },
  } as ValidationRule,
};

export type { FieldValidationState, ValidationRule, ValidationMode };

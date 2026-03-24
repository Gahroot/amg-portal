import * as React from "react";
import { z } from "zod/v4";

/**
 * Validation mode for field validation
 */
export type ValidationMode = "onChange" | "onBlur" | "onSubmit" | "all";

/**
 * Validation rule configuration
 */
export interface ValidationRule {
  /** Check if field is required */
  required?: boolean | string;
  /** Minimum length for strings */
  minLength?: number | { value: number; message: string };
  /** Maximum length for strings */
  maxLength?: number | { value: number; message: string };
  /** Minimum value for numbers */
  min?: number | { value: number; message: string };
  /** Maximum value for numbers */
  max?: number | { value: number; message: string };
  /** Pattern to match (regex or string) */
  pattern?: RegExp | { value: RegExp; message: string };
  /** Email validation */
  email?: boolean | string;
  /** URL validation */
  url?: boolean | string;
  /** Phone number validation */
  phone?: boolean | string;
  /** Custom validation function */
  validate?: (value: unknown) => boolean | string | Promise<boolean | string>;
  /** Zod schema for validation */
  schema?: z.ZodType;
}

/**
 * Field validation state
 */
export interface FieldValidationState {
  /** Whether the field has been touched */
  isTouched: boolean;
  /** Whether the field is dirty (has changes) */
  isDirty: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Whether validation is in progress (for async validators) */
  isValidating: boolean;
  /** Whether the field is valid */
  isValid: boolean;
}

/**
 * Options for useFieldValidation hook
 */
export interface UseFieldValidationOptions {
  /** Validation rules to apply */
  rules?: ValidationRule;
  /** Validation mode */
  mode?: ValidationMode;
  /** Debounce delay in ms for onChange validation */
  debounceMs?: number;
  /** Initial value */
  initialValue?: unknown;
  /** Validate on mount */
  validateOnMount?: boolean;
  /** Callback when validation state changes */
  onValidationChange?: (state: FieldValidationState) => void;
}

/**
 * Default validation messages
 */
const DEFAULT_MESSAGES = {
  required: "This field is required",
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be at most ${max} characters`,
  min: (min: number) => `Must be at least ${min}`,
  max: (max: number) => `Must be at most ${max}`,
  pattern: "Invalid format",
  email: "Please enter a valid email address",
  url: "Please enter a valid URL",
  phone: "Please enter a valid phone number",
};

/**
 * Extract message from rule value
 */
function extractMessage(
  rule: string | boolean | number | { value: unknown; message: string } | undefined,
  defaultMessage: string
): string {
  if (typeof rule === "string") return rule;
  if (typeof rule === "object" && rule !== null && "message" in rule) {
    return rule.message;
  }
  return defaultMessage;
}

/**
 * Extract value from rule
 */
function extractValue<T>(
  rule: T | { value: T; message: string } | undefined
): T | undefined {
  if (typeof rule === "object" && rule !== null && "value" in rule) {
    return rule.value;
  }
  return rule as T | undefined;
}

/**
 * Validate a value against a set of rules
 */
async function validateValue(
  value: unknown,
  rules: ValidationRule
): Promise<string | null> {
  const stringValue = value === null || value === undefined ? "" : String(value);
  const isEmpty = stringValue === "";

  // Required validation
  if (rules.required) {
    if (isEmpty) {
      return extractMessage(rules.required, DEFAULT_MESSAGES.required);
    }
  }

  // Skip other validations if empty and not required
  if (isEmpty) {
    return null;
  }

  // Zod schema validation (takes precedence)
  if (rules.schema) {
    const result = await rules.schema.safeParseAsync(value);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return firstError?.message ?? "Invalid value";
    }
    return null;
  }

  // Min length validation
  if (rules.minLength !== undefined) {
    const minLen = extractValue(rules.minLength);
    if (minLen !== undefined && stringValue.length < minLen) {
      return extractMessage(rules.minLength, DEFAULT_MESSAGES.minLength(minLen));
    }
  }

  // Max length validation
  if (rules.maxLength !== undefined) {
    const maxLen = extractValue(rules.maxLength);
    if (maxLen !== undefined && stringValue.length > maxLen) {
      return extractMessage(rules.maxLength, DEFAULT_MESSAGES.maxLength(maxLen));
    }
  }

  // Min value validation
  if (rules.min !== undefined) {
    const minVal = extractValue(rules.min);
    const numValue = Number(value);
    if (minVal !== undefined && !isNaN(numValue) && numValue < minVal) {
      return extractMessage(rules.min, DEFAULT_MESSAGES.min(minVal));
    }
  }

  // Max value validation
  if (rules.max !== undefined) {
    const maxVal = extractValue(rules.max);
    const numValue = Number(value);
    if (maxVal !== undefined && !isNaN(numValue) && numValue > maxVal) {
      return extractMessage(rules.max, DEFAULT_MESSAGES.max(maxVal));
    }
  }

  // Pattern validation
  if (rules.pattern) {
    const pattern = extractValue(rules.pattern);
    if (pattern && !pattern.test(stringValue)) {
      if (typeof rules.pattern === "object" && "message" in rules.pattern) {
        return rules.pattern.message;
      }
      return DEFAULT_MESSAGES.pattern;
    }
  }

  // Email validation
  if (rules.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(stringValue)) {
      return extractMessage(rules.email, DEFAULT_MESSAGES.email);
    }
  }

  // URL validation
  if (rules.url) {
    try {
      new URL(stringValue);
    } catch {
      return extractMessage(rules.url, DEFAULT_MESSAGES.url);
    }
  }

  // Phone validation
  if (rules.phone) {
    const phonePattern = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
    if (!phonePattern.test(stringValue) || stringValue.replace(/\D/g, "").length < 7) {
      return extractMessage(rules.phone, DEFAULT_MESSAGES.phone);
    }
  }

  // Custom validation
  if (rules.validate) {
    const result = await rules.validate(value);
    if (result === false) {
      return "Invalid value";
    }
    if (typeof result === "string") {
      return result;
    }
  }

  return null;
}

/**
 * Hook for field-level validation with debouncing and real-time feedback.
 *
 * @example
 * ```tsx
 * const { value, error, onChange, onBlur, isValid } = useFieldValidation({
 *   rules: {
 *     required: true,
 *     email: true,
 *   },
 *   mode: "onChange",
 *   debounceMs: 300,
 * });
 * ```
 */
export function useFieldValidation<T = string>(
  options: UseFieldValidationOptions = {}
) {
  const {
    rules = {},
    mode = "onBlur",
    debounceMs = 300,
    initialValue,
    validateOnMount = false,
    onValidationChange,
  } = options;

  const [value, setValue] = React.useState<T>((initialValue ?? "") as T);
  const [state, setState] = React.useState<FieldValidationState>({
    isTouched: false,
    isDirty: false,
    error: null,
    isValidating: false,
    isValid: !validateOnMount,
  });

  // Refs for debouncing
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Track previous state for callback
  const prevStateRef = React.useRef<FieldValidationState>(state);

  // Notify on state changes
  React.useEffect(() => {
    if (
      onValidationChange &&
      JSON.stringify(prevStateRef.current) !== JSON.stringify(state)
    ) {
      prevStateRef.current = state;
      onValidationChange(state);
    }
  }, [state, onValidationChange]);

  // Run validation
  const runValidation = React.useCallback(
    async (val: unknown) => {
      // Cancel any pending validation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setState((prev) => ({ ...prev, isValidating: true }));

      try {
        const error = await validateValue(val, rules);
        const signal = abortControllerRef.current.signal;

        if (!signal.aborted) {
          setState((prev) => ({
            ...prev,
            error,
            isValidating: false,
            isValid: error === null,
          }));
          return error === null;
        }
      } catch {
        // Validation was aborted or error occurred
        setState((prev) => ({ ...prev, isValidating: false }));
      }
      return false;
    },
    [rules]
  );

  // Validate on mount if requested
  React.useEffect(() => {
    if (validateOnMount) {
      runValidation(value);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle value change
  const handleChange = React.useCallback(
    (newValue: T) => {
      setValue(newValue);
      setState((prev) => ({ ...prev, isDirty: true }));

      // Clear debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Validate on change if mode is 'onChange' or 'all'
      if (mode === "onChange" || mode === "all") {
        debounceRef.current = setTimeout(() => {
          runValidation(newValue);
        }, debounceMs);
      }
    },
    [mode, debounceMs, runValidation]
  );

  // Handle blur
  const handleBlur = React.useCallback(() => {
    setState((prev) => ({ ...prev, isTouched: true }));

    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Validate on blur if mode is 'onBlur' or 'all'
    if (mode === "onBlur" || mode === "all") {
      runValidation(value);
    }
  }, [mode, value, runValidation]);

  // Manual validate function
  const validate = React.useCallback(() => {
    return runValidation(value);
  }, [value, runValidation]);

  // Reset field
  const reset = React.useCallback(() => {
    setValue((initialValue ?? "") as T);
    setState({
      isTouched: false,
      isDirty: false,
      error: null,
      isValidating: false,
      isValid: !validateOnMount,
    });
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [initialValue, validateOnMount]);

  // Clear error
  const clearError = React.useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Set error manually
  const setError = React.useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error,
      isValid: error === null,
      isTouched: true,
    }));
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    /** Current field value */
    value,
    /** Current validation state */
    ...state,
    /** Handle value change (call this in onChange) */
    onChange: handleChange,
    /** Handle blur (call this in onBlur) */
    onBlur: handleBlur,
    /** Manually trigger validation */
    validate,
    /** Reset field to initial state */
    reset,
    /** Clear error message */
    clearError,
    /** Set error manually */
    setError,
    /** Set value directly */
    setValue,
  };
}

/**
 * Hook for validating multiple fields at once
 */
export function useFieldsValidation<T extends Record<string, unknown>>(
  fields: {
    [K in keyof T]?: UseFieldValidationOptions;
  }
) {
  const fieldValidations = React.useMemo(() => {
    const validations: Partial<{
      [K in keyof T]: ReturnType<typeof useFieldValidation>;
    }> = {};

    for (const key in fields) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      validations[key] = useFieldValidation(fields[key]);
    }

    return validations;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validateAll = React.useCallback(async () => {
    const results = await Promise.all(
      Object.values(fieldValidations).map((field) => field?.validate())
    );
    return results.every(Boolean);
  }, [fieldValidations]);

  const resetAll = React.useCallback(() => {
    Object.values(fieldValidations).forEach((field) => field?.reset());
  }, [fieldValidations]);

  const isValid = React.useMemo(() => {
    return Object.values(fieldValidations).every(
      (field) => field?.isValid !== false
    );
  }, [fieldValidations]);

  const hasErrors = React.useMemo(() => {
    return Object.values(fieldValidations).some((field) => field?.error !== null);
  }, [fieldValidations]);

  return {
    fields: fieldValidations,
    validateAll,
    resetAll,
    isValid,
    hasErrors,
  };
}

export type FieldValidationReturn = ReturnType<typeof useFieldValidation>;

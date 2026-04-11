import type { ValidationRule } from "@/hooks/use-field-validation";
import type { ValidationResult } from "./types";

/**
 * Validate value using validation rules
 */
export async function validateValue(
  value: unknown,
  rules?: ValidationRule,
  customValidate?: (value: unknown) => ValidationResult | Promise<ValidationResult>,
): Promise<ValidationResult> {
  // Custom validation takes precedence
  if (customValidate) {
    const result = await customValidate(value);
    if (!result.isValid) {
      return result;
    }
  }

  // Required validation
  if (rules?.required) {
    const isEmpty = value == null || value === "";
    if (isEmpty) {
      return {
        isValid: false,
        error:
          typeof rules.required === "string" ? rules.required : "This field is required",
      };
    }
  }

  // Email validation
  if (rules?.email && value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(String(value))) {
      return {
        isValid: false,
        error: typeof rules.email === "string" ? rules.email : "Please enter a valid email",
      };
    }
  }

  // URL validation
  if (rules?.url && value) {
    try {
      new URL(String(value));
    } catch {
      return {
        isValid: false,
        error: typeof rules.url === "string" ? rules.url : "Please enter a valid URL",
      };
    }
  }

  // Min length
  if (rules?.minLength !== undefined && value) {
    const minLen =
      typeof rules.minLength === "object" ? rules.minLength.value : rules.minLength;
    if (String(value).length < minLen) {
      return {
        isValid: false,
        error:
          typeof rules.minLength === "object"
            ? rules.minLength.message
            : `Minimum ${minLen} characters required`,
      };
    }
  }

  // Max length
  if (rules?.maxLength !== undefined && value) {
    const maxLen =
      typeof rules.maxLength === "object" ? rules.maxLength.value : rules.maxLength;
    if (String(value).length > maxLen) {
      return {
        isValid: false,
        error:
          typeof rules.maxLength === "object"
            ? rules.maxLength.message
            : `Maximum ${maxLen} characters allowed`,
      };
    }
  }

  // Min value (for numbers)
  if (rules?.min !== undefined && value !== "" && value !== null) {
    const minVal = typeof rules.min === "object" ? rules.min.value : rules.min;
    if (Number(value) < minVal) {
      return {
        isValid: false,
        error:
          typeof rules.min === "object" ? rules.min.message : `Minimum value is ${minVal}`,
      };
    }
  }

  // Max value (for numbers)
  if (rules?.max !== undefined && value !== "" && value !== null) {
    const maxVal = typeof rules.max === "object" ? rules.max.value : rules.max;
    if (Number(value) > maxVal) {
      return {
        isValid: false,
        error:
          typeof rules.max === "object" ? rules.max.message : `Maximum value is ${maxVal}`,
      };
    }
  }

  // Pattern validation
  if (rules?.pattern && value) {
    const patternObj = rules.pattern;
    const pattern = "value" in patternObj ? patternObj.value : patternObj;
    if (!pattern.test(String(value))) {
      return {
        isValid: false,
        error:
          "value" in patternObj && "message" in patternObj
            ? patternObj.message
            : "Invalid format",
      };
    }
  }

  // Custom validation function from rules
  if (rules?.validate) {
    const result = await rules.validate(value);
    if (result === false) {
      return { isValid: false, error: "Invalid value" };
    }
    if (typeof result === "string") {
      return { isValid: false, error: result };
    }
  }

  return { isValid: true };
}

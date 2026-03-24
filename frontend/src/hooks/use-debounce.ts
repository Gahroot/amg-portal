import * as React from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms
 * of inactivity. Use this to avoid firing expensive operations (API calls,
 * URL updates) on every keystroke.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

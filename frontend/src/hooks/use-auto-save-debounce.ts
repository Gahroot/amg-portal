import { useRef, useCallback, useEffect } from "react";

/**
 * Return type for useAutoSaveDebounce
 */
export interface UseAutoSaveDebounceReturn<T> {
  /**
   * Schedule a debounced save. Each call resets the timer; the save callback
   * fires only after `delay` ms of inactivity.
   */
  debouncedSave: (data: T) => void;
  /** Cancel any pending debounced save */
  cancelDebounce: () => void;
}

/**
 * Hook that wraps a save callback in a debounce timer.
 *
 * The timeout is automatically cleared on unmount to prevent memory leaks.
 *
 * @param save   Async save function to debounce (must be stable/memoised)
 * @param delay  Debounce delay in milliseconds (default 500ms)
 */
export function useAutoSaveDebounce<T>(
  save: (data: T) => Promise<void>,
  delay = 500
): UseAutoSaveDebounceReturn<T> {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cancelDebounce = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const debouncedSave = useCallback(
    (data: T) => {
      cancelDebounce();
      timeoutRef.current = setTimeout(() => {
        void save(data);
      }, delay);
    },
    [save, delay, cancelDebounce]
  );

  // Cleanup on unmount
  useEffect(() => cancelDebounce, [cancelDebounce]);

  return { debouncedSave, cancelDebounce };
}

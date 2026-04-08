"use client";

import { useState, useRef, useCallback, useMemo, useEffect, type SetStateAction } from "react";

/**
 * History state for undo/redo functionality
 */
interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * Options for the useUndo hook
 */
export interface UseUndoOptions<T> {
  /** Maximum number of history entries to keep */
  maxHistory?: number;
  /** Debounce time in ms before pushing to history (useful for text input) */
  debounceMs?: number;
  /** Equality check function - return true if states are equal */
  isEqual?: (a: T, b: T) => boolean;
}

/**
 * Return type for the useUndo hook
 */
export interface UseUndoReturn<T> {
  /** Current state value */
  value: T;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Set a new value (adds to history) */
  setValue: (value: SetStateAction<T>) => void;
  /** Update value without adding to history */
  updateValue: (value: SetStateAction<T>) => void;
  /** Undo the last change */
  undo: () => void;
  /** Redo the last undone change */
  redo: () => void;
  /** Clear history and reset to initial value */
  reset: (value?: T) => void;
  /** Clear all history (past and future) */
  clearHistory: () => void;
  /** Current position in history (0 = most recent) */
  historyLength: number;
  /** Number of items that can be redone */
  futureLength: number;
}

/**
 * A hook for managing state with undo/redo capability.
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const { value, setValue, undo, redo, canUndo, canRedo } = useUndo({
 *     name: '',
 *     email: '',
 *   });
 *
 *   return (
 *     <form>
 *       <input
 *         value={value.name}
 *         onChange={(e) => setValue({ ...value, name: e.target.value })}
 *       />
 *       <button onClick={undo} disabled={!canUndo}>Undo</button>
 *       <button onClick={redo} disabled={!canRedo}>Redo</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useUndo<T>(
  initialValue: T | (() => T),
  options: UseUndoOptions<T> = {}
): UseUndoReturn<T> {
  const { maxHistory = 50, debounceMs = 300, isEqual = Object.is } = options;

  // Resolve initial value
  const resolvedInitialValue = useMemo(() => {
    return typeof initialValue === "function"
      ? (initialValue as () => T)()
      : initialValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: resolvedInitialValue,
    future: [],
  });

  // Refs for debounce handling
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pendingValueRef = useRef<T | null>(null);

  // Keep track of initial value for reset
  const initialValueRef = useRef(resolvedInitialValue);

  // Update initial value ref if prop changes
  useEffect(() => {
    initialValueRef.current = resolvedInitialValue;
  }, [resolvedInitialValue]);

  const { past, present, future } = history;

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // Flush pending debounced value to history
  const flushDebounce = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (pendingValueRef.current !== null) {
      const pendingValue = pendingValueRef.current;
      pendingValueRef.current = null;

      setHistory((prev) => {
        // Skip if value hasn't changed
        if (isEqual(prev.present, pendingValue)) {
          return prev;
        }

        // Add current present to past, limit history size
        const newPast = [...prev.past, prev.present].slice(-maxHistory);

        return {
          past: newPast,
          present: pendingValue,
          future: [], // Clear future on new change
        };
      });
    }
  }, [isEqual, maxHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Set a new value and add to history
   */
  const setValue: UseUndoReturn<T>["setValue"] = useCallback(
    (action) => {
      // Cancel any pending flush
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Calculate new value
      setHistory((prev) => {
        const newValue =
          typeof action === "function"
            ? (action as (prev: T) => T)(prev.present)
            : action;

        // Skip if value hasn't changed
        if (isEqual(prev.present, newValue)) {
          return prev;
        }

        // If debounce is enabled, store pending value
        if (debounceMs > 0) {
          pendingValueRef.current = newValue;

          debounceTimeoutRef.current = setTimeout(() => {
            flushDebounce();
          }, debounceMs);

          // Update present without adding to history yet
          return {
            ...prev,
            present: newValue,
          };
        }

        // No debounce - add to history immediately
        const newPast = [...prev.past, prev.present].slice(-maxHistory);

        return {
          past: newPast,
          present: newValue,
          future: [], // Clear future on new change
        };
      });
    },
    [debounceMs, isEqual, maxHistory, flushDebounce]
  );

  /**
   * Update value without adding to history
   */
  const updateValue: UseUndoReturn<T>["updateValue"] = useCallback(
    (action) => {
      setHistory((prev) => {
        const newValue =
          typeof action === "function"
            ? (action as (prev: T) => T)(prev.present)
            : action;

        if (isEqual(prev.present, newValue)) {
          return prev;
        }

        return {
          ...prev,
          present: newValue,
        };
      });
    },
    [isEqual]
  );

  /**
   * Undo the last change
   */
  const undo = useCallback(() => {
    // Flush any pending changes first
    flushDebounce();

    setHistory((prev) => {
      if (prev.past.length === 0) {
        return prev;
      }

      const newPast = prev.past.slice(0, -1);
      const newPresent = prev.past[prev.past.length - 1] as T;

      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, [flushDebounce]);

  /**
   * Redo the last undone change
   */
  const redo = useCallback(() => {
    // Flush any pending changes first
    flushDebounce();

    setHistory((prev) => {
      if (prev.future.length === 0) {
        return prev;
      }

      const newPresent = prev.future[0] as T;
      const newFuture = prev.future.slice(1);

      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, [flushDebounce]);

  /**
   * Reset to initial or specified value, clearing all history
   */
  const reset: UseUndoReturn<T>["reset"] = useCallback(
    (value) => {
      // Cancel any pending debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      pendingValueRef.current = null;

      const newValue = value !== undefined ? value : initialValueRef.current;

      setHistory({
        past: [],
        present: newValue,
        future: [],
      });
    },
    []
  );

  /**
   * Clear history without changing present value
   */
  const clearHistory = useCallback(() => {
    // Cancel any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    pendingValueRef.current = null;

    setHistory((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }));
  }, []);

  return {
    value: present,
    canUndo,
    canRedo,
    setValue,
    updateValue,
    undo,
    redo,
    reset,
    clearHistory,
    historyLength: past.length,
    futureLength: future.length,
  };
}

/**
 * A simpler hook for single value undo/redo (like a text field)
 *
 * @example
 * ```tsx
 * function TextInput() {
 *   const { value, setValue, undo, redo, canUndo, canRedo } = useUndoValue('');
 *
 *   return (
 *     <div>
 *       <input
 *         value={value}
 *         onChange={(e) => setValue(e.target.value)}
 *       />
 *       <button onClick={undo} disabled={!canUndo}>Undo</button>
 *       <button onClick={redo} disabled={!canRedo}>Redo</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUndoValue<T>(
  initialValue: T | (() => T),
  options?: Omit<UseUndoOptions<T>, "isEqual">
): UseUndoReturn<T> {
  return useUndo(initialValue, {
    ...options,
    isEqual: (a, b) => a === b,
  });
}

/**
 * Hook for managing form state with undo/redo
 * Provides a more form-friendly API with field-level updates
 *
 * @example
 * ```tsx
 * interface FormData {
 *   name: string;
 *   email: string;
 * }
 *
 * function MyForm() {
 *   const { values, setField, undo, redo, canUndo, canRedo, reset } = useFormUndo<FormData>({
 *     name: '',
 *     email: '',
 *   });
 *
 *   return (
 *     <form onSubmit={() => reset()}>
 *       <input
 *         value={values.name}
 *         onChange={(e) => setField('name', e.target.value)}
 *       />
 *     </form>
 *   );
 * }
 * ```
 */
export function useFormUndo<T extends Record<string, unknown>>(
  initialValues: T | (() => T),
  options?: UseUndoOptions<T>
) {
  const undoState = useUndo(initialValues, {
    debounceMs: 300,
    ...options,
  });

  const setField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      undoState.setValue((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [undoState]
  );

  const setFields = useCallback(
    (updates: Partial<T>) => {
      undoState.setValue((prev) => ({
        ...prev,
        ...updates,
      }));
    },
    [undoState]
  );

  return {
    ...undoState,
    values: undoState.value,
    setField,
    setFields,
  };
}

export default useUndo;

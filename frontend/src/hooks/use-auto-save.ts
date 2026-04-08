import { useState, useRef, useCallback, useEffect, type BaseSyntheticEvent } from "react";

/**
 * Auto-save status states
 */
export type AutoSaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved";

/**
 * Draft data structure stored in localStorage
 */
export interface DraftData<T> {
  data: T;
  timestamp: number;
  formId: string;
}

/**
 * Options for the useAutoSave hook
 */
export interface UseAutoSaveOptions<T> {
  /** Unique identifier for this form (used as localStorage key) */
  formId: string;
  /** Initial form data to compare against for change detection */
  initialData?: T;
  /** Save callback - can be async, returns true on success */
  onSave?: (data: T) => Promise<boolean> | boolean;
  /** Debounce delay in milliseconds (default: 500ms) */
  debounceDelay?: number;
  /** Auto-save interval in milliseconds (default: 30000ms = 30s) */
  interval?: number;
  /** Whether to save on field blur (default: true) */
  saveOnBlur?: boolean;
  /** Whether to enable periodic auto-save (default: true) */
  enablePeriodicSave?: boolean;
  /** Whether to persist to localStorage (default: true) */
  persistToLocalStorage?: boolean;
  /** Callback when save status changes */
  onStatusChange?: (status: AutoSaveStatus) => void;
}

/**
 * Return type for the useAutoSave hook
 */
export interface UseAutoSaveReturn<T> {
  /** Current auto-save status */
  status: AutoSaveStatus;
  /** Timestamp of the last successful save */
  lastSaved: Date | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Manually trigger a save */
  save: (data: T) => Promise<void>;
  /** Debounced save — waits for debounceDelay ms of inactivity before saving */
  debouncedSave: (data: T) => void;
  /** Clear the draft from localStorage */
  clearDraft: () => void;
  /** Check if a draft exists for recovery */
  hasDraft: () => boolean;
  /** Get the draft data for recovery */
  getDraft: () => DraftData<T> | null;
  /** Restore draft data - returns the data or null if no draft */
  restoreDraft: () => T | null;
  /** Mark the form as submitted (clears draft and resets state) */
  markSubmitted: () => void;
  /** Reset unsaved changes tracking */
  resetChanges: () => void;
}

const DEFAULT_DEBOUNCE_DELAY = 500;
const DEFAULT_INTERVAL = 30000; // 30 seconds

/**
 * Hook for auto-saving form data with draft recovery support.
 *
 * Features:
 * - Periodic auto-save (every 30s by default)
 * - Save on field blur (debounced)
 * - LocalStorage persistence for draft recovery
 * - Status tracking (idle, saving, saved, error, unsaved)
 *
 * @example
 * ```tsx
 * const { status, lastSaved, save, clearDraft, hasDraft, restoreDraft, markSubmitted } = useAutoSave({
 *   formId: 'client-intake-form',
 *   initialData: { name: '', email: '' },
 *   onSave: async (data) => {
 *     await api.saveDraft(data);
 *     return true;
 *   },
 * });
 *
 * // Check for draft on mount
 * useEffect(() => {
 *   if (hasDraft()) {
 *     setShowRecoveryDialog(true);
 *   }
 * }, []);
 *
 * // Restore draft
 * const handleRestore = () => {
 *   const draft = restoreDraft();
 *   if (draft) {
 *     form.reset(draft);
 *   }
 * };
 * ```
 */
export function useAutoSave<T extends Record<string, unknown>>(
  options: UseAutoSaveOptions<T>
): UseAutoSaveReturn<T> {
  const {
    formId,
    initialData,
    onSave,
    debounceDelay = DEFAULT_DEBOUNCE_DELAY,
    interval = DEFAULT_INTERVAL,
    enablePeriodicSave = true,
    persistToLocalStorage = true,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const currentDataRef = useRef<T | undefined>(initialData);
  const isSubmittedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const storageKey = `amg-draft-${formId}`;

  // Update status and notify callback
  const updateStatus = useCallback(
    (newStatus: AutoSaveStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Get draft from localStorage
  const getDraft = useCallback((): DraftData<T> | null => {
    if (typeof window === "undefined") return null;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;

      const draft = JSON.parse(raw) as DraftData<T>;
      return draft;
    } catch {
      console.warn(`Failed to parse draft for ${formId}`);
      return null;
    }
  }, [storageKey, formId]);

  // Check if draft exists
  const hasDraft = useCallback((): boolean => {
    return getDraft() !== null;
  }, [getDraft]);

  // Restore draft data
  const restoreDraft = useCallback((): T | null => {
    const draft = getDraft();
    return draft?.data ?? null;
  }, [getDraft]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(storageKey);
    } catch {
      console.warn(`Failed to clear draft for ${formId}`);
    }
  }, [storageKey, formId]);

  // Save to localStorage
  const saveToLocalStorage = useCallback(
    (data: T) => {
      if (!persistToLocalStorage || typeof window === "undefined") return;

      try {
        const draft: DraftData<T> = {
          data,
          timestamp: Date.now(),
          formId,
        };
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        console.warn(`Failed to save draft to localStorage for ${formId}`);
      }
    },
    [formId, persistToLocalStorage, storageKey]
  );

  // Main save function
  const save = useCallback(
    async (data: T) => {
      if (isSubmittedRef.current) return;

      currentDataRef.current = data;
      updateStatus("saving");

      try {
        // Save to localStorage first (always succeeds)
        saveToLocalStorage(data);

        // Call external save handler if provided
        if (onSave) {
          const success = await onSave(data);
          if (!success) {
            updateStatus("error");
            return;
          }
        }

        setLastSaved(new Date());
        updateStatus("saved");
        setHasUnsavedChanges(false);

        // Reset to idle after 2 seconds
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          updateStatus("idle");
        }, 2000);
      } catch {
        updateStatus("error");
      }
    },
    [onSave, saveToLocalStorage, updateStatus]
  );

  // Mark as submitted - clears draft and resets state
  const markSubmitted = useCallback(() => {
    isSubmittedRef.current = true;
    clearDraft();
    setHasUnsavedChanges(false);
    updateStatus("idle");
  }, [clearDraft, updateStatus]);

  // Reset changes tracking
  const resetChanges = useCallback(() => {
    setHasUnsavedChanges(false);
    updateStatus("idle");
  }, [updateStatus]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Debounced save — delays the save call by `debounceDelay` ms, cancelling
  // any pending invocation on each new call.
  const debouncedSave = useCallback(
    (data: T) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        void save(data);
      }, debounceDelay);
    },
    [save, debounceDelay]
  );

  // Periodic auto-save
  useEffect(() => {
    if (!enablePeriodicSave || !currentDataRef.current) return;

    const intervalId = setInterval(() => {
      if (currentDataRef.current && hasUnsavedChanges) {
        save(currentDataRef.current);
      }
    }, interval);

    return () => clearInterval(intervalId);
  }, [enablePeriodicSave, interval, hasUnsavedChanges, save]);

  return {
    status,
    lastSaved,
    hasUnsavedChanges,
    save,
    debouncedSave,
    clearDraft,
    hasDraft,
    getDraft,
    restoreDraft,
    markSubmitted,
    resetChanges,
  };
}

/**
 * Hook for tracking form changes and triggering auto-save on blur.
 * Use this alongside useAutoSave for complete auto-save functionality.
 *
 * @example
 * ```tsx
 * const form = useForm<FormValues>({ defaultValues: initialValues });
 * const { save, status } = useAutoSave({ formId: 'my-form' });
 *
 * useAutoSaveOnBlur({
 *   watch: form.watch,
 *   save,
 *   initialData: initialValues,
 *   debounceDelay: 500,
 * });
 * ```
 */
export function useAutoSaveOnBlur<T extends Record<string, unknown>>(options: {
  /** React Hook Form's watch function */
  watch: (callback: (data: T) => void) => () => void;
  /** Save function from useAutoSave */
  save: (data: T) => Promise<void>;
  /** Initial data for comparison */
  initialData?: T;
  /** Debounce delay (default: 500ms) */
  debounceDelay?: number;
  /** Callback when unsaved changes state changes */
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
}): void {
  const { watch, save, initialData, debounceDelay = 500, onUnsavedChangesChange } = options;

  const dataRef = useRef<T | undefined>(initialData);
  const lastSavedDataRef = useRef<string>(JSON.stringify(initialData ?? {}));

  useEffect(() => {
    const unsubscribe = watch((data) => {
      dataRef.current = data as T;

      const currentDataStr = JSON.stringify(data);
      const hasChanges = currentDataStr !== lastSavedDataRef.current;
      onUnsavedChangesChange?.(hasChanges);
    });

    return unsubscribe;
  }, [watch, onUnsavedChangesChange]);

  // Debounced save on change
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback(
    (data: T) => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      timeoutIdRef.current = setTimeout(() => {
        save(data);
        lastSavedDataRef.current = JSON.stringify(data);
      }, debounceDelay);
    },
    [save, debounceDelay]
  );

  // Save on window blur (leaving page)
  useEffect(() => {
    const handleBlur = () => {
      if (dataRef.current) {
        debouncedSave(dataRef.current);
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [debouncedSave]);
}

/**
 * Hook for detecting unsaved changes and prompting before navigation.
 *
 * @example
 * ```tsx
 * useUnsavedChangesWarning(hasUnsavedChanges);
 * ```
 */
export function useUnsavedChangesWarning(
  hasUnsavedChanges: boolean,
  message = "You have unsaved changes. Are you sure you want to leave?"
): void {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, message]);
}

/**
 * Custom hook that combines useAutoSave with React Hook Form.
 *
 * @example
 * ```tsx
 * const form = useForm<FormValues>({
 *   defaultValues: { name: '', email: '' },
 * });
 *
 * const autoSave = useAutoSaveWithForm({
 *   form,
 *   formId: 'my-form',
 *   onSave: async (data) => {
 *     await api.saveDraft(data);
 *     return true;
 *   },
 * });
 *
 * return (
 *   <form onSubmit={form.handleSubmit(autoSave.handleSubmit)}>
 *     <AutoSaveIndicator status={autoSave.status} lastSaved={autoSave.lastSaved} />
 *     ...
 *   </form>
 * );
 * ```
 */
export function useAutoSaveWithForm<T extends Record<string, unknown>>(
  options: UseAutoSaveOptions<T> & {
    form: {
      watch: (callback: (data: T) => void) => () => void;
      getValues: () => T;
      reset: (values?: T) => void;
      handleSubmit: (onSubmit: (data: T) => Promise<void>) => (e?: BaseSyntheticEvent) => Promise<void>;
    };
  }
): UseAutoSaveReturn<T> & {
  handleSubmit: (data: T) => Promise<void>;
} {
  const { form, saveOnBlur = true, ...autoSaveOptions } = options;
  const autoSave = useAutoSave<T>({ ...autoSaveOptions, saveOnBlur });

  const {
    debouncedSave: autoSaveDebouncedSave,
    save: autoSaveSave,
    markSubmitted: autoSaveMarkSubmitted,
  } = autoSave;

  // Track form changes and debounce saves — depend only on `form.watch`
  // (stable subscription function) and `autoSaveDebouncedSave` (memoised via
  // useCallback) so the effect is not torn down/re-registered on every render.
  useEffect(() => {
    const unsubscribe = form.watch((data) => {
      autoSaveDebouncedSave(data as T);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch, autoSaveDebouncedSave]);

  // Save immediately when the window loses focus (user switches tab/app).
  // Honour the `saveOnBlur` option — skip if disabled.
  useEffect(() => {
    if (!saveOnBlur) return;

    const handleWindowBlur = () => {
      const data = form.getValues();
      void autoSaveSave(data);
    };

    window.addEventListener("blur", handleWindowBlur);
    return () => window.removeEventListener("blur", handleWindowBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveOnBlur, form.getValues, autoSaveSave]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (_data: T) => {
      // Clear draft on successful submission
      autoSaveMarkSubmitted();
    },
    [autoSaveMarkSubmitted]
  );

  return {
    ...autoSave,
    handleSubmit,
  };
}

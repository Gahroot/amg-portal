"use client"

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import type { Label as LabelPrimitive } from "radix-ui"
import { Slot } from "radix-ui"
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  useWatch,
  type Control,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type UseFormGetValues,
  type UseFormSetValue,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  FormUndoRedo,
  type FormUndoRedoProps,
} from "@/components/ui/form-undo-redo"

const Form = FormProvider

// ============================================================================
// Form Undo/Redo Context
// ============================================================================

/**
 * Context for form undo/redo functionality
 */
interface FormUndoContextValue {
  /** Whether undo is available */
  canUndo: boolean
  /** Whether redo is available */
  canRedo: boolean
  /** Undo the last change */
  undo: () => void
  /** Redo the last undone change */
  redo: () => void
  /** Clear undo/redo history */
  clearHistory: () => void
  /** Number of undo steps available */
  undoCount: number
  /** Number of redo steps available */
  redoCount: number
}

const FormUndoContext = createContext<FormUndoContextValue | null>(null)

/**
 * Hook to access form undo/redo functionality.
 * Must be used within a FormUndoProvider.
 *
 * @example
 * ```tsx
 * function FormControls() {
 *   const { canUndo, canRedo, undo, redo } = useFormUndo()
 *
 *   return (
 *     <div>
 *       <button onClick={undo} disabled={!canUndo}>Undo</button>
 *       <button onClick={redo} disabled={!canRedo}>Redo</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useFormUndo() {
  const context = useContext(FormUndoContext)
  if (!context) {
    throw new Error("useFormUndo must be used within a FormUndoProvider")
  }
  return context
}

/**
 * Props for FormUndoProvider
 */
export interface FormUndoProviderProps<T extends FieldValues> {
  children: ReactNode
  /** React Hook Form control object */
  control: Control<T>
  /** Maximum number of history entries */
  maxHistory?: number
  /** Debounce time in ms before pushing to history */
  debounceMs?: number
  /** Keys to watch for changes (all fields if not specified) */
  watchKeys?: Array<FieldPath<T>>
}

/**
 * Provider that tracks form changes and provides undo/redo functionality.
 * Works with react-hook-form forms.
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const form = useForm({ defaultValues: { name: '', email: '' } })
 *
 *   return (
 *     <FormUndoProvider control={form.control}>
 *       <form onSubmit={form.handleSubmit(onSubmit)}>
 *         <FormUndoControls />
 *         <input {...form.register('name')} />
 *       </form>
 *     </FormUndoProvider>
 *   )
 * }
 * ```
 */
export function FormUndoProvider<T extends FieldValues>({
  children,
  control,
  maxHistory = 50,
  debounceMs = 300,
  watchKeys,
}: FormUndoProviderProps<T>) {
  const { getValues, setValue } = useFormContext() as {
    getValues: UseFormGetValues<T>
    setValue: UseFormSetValue<T>
  }

  // History state using useState to trigger re-renders
  const [historyState, setHistoryState] = useState<{
    past: T[]
    future: T[]
  }>({
    past: [],
    future: [],
  })

  // Debounce tracking
  const debounceRef = useRef<{
    timeoutId: ReturnType<typeof setTimeout> | null
    pendingSnapshot: T | null
  }>({
    timeoutId: null,
    pendingSnapshot: null,
  })

  // Track the last snapshot for comparison
  const lastSnapshotRef = useRef<T | null>(null)

  // Watch form values
  const watchedValues = useWatch({
    control,
    name: watchKeys as never,
  }) as T

  // Get current form values as a snapshot
  const getSnapshot = useCallback(() => {
    const values = getValues()
    // Deep clone to avoid reference issues
    return JSON.parse(JSON.stringify(values)) as T
  }, [getValues])

  // Push current state to history
  const pushToHistory = useCallback(
    (snapshot: T) => {
      // Don't push if it's the same as the last snapshot
      if (
        lastSnapshotRef.current &&
        JSON.stringify(lastSnapshotRef.current) === JSON.stringify(snapshot)
      ) {
        return
      }

      const newPast = [...historyState.past, lastSnapshotRef.current || snapshot].slice(-maxHistory)
      lastSnapshotRef.current = snapshot

      // Update state with new past and clear future
      setHistoryState({
        past: newPast,
        future: [],
      })
    },
    [maxHistory, historyState.past]
  )

  // Debounced history push
  const debouncedPush = useCallback(
    (snapshot: T) => {
      // Store pending snapshot
      debounceRef.current.pendingSnapshot = snapshot

      // Clear existing timeout
      if (debounceRef.current.timeoutId) {
        clearTimeout(debounceRef.current.timeoutId)
      }

      // Set new timeout
      debounceRef.current.timeoutId = setTimeout(() => {
        if (debounceRef.current.pendingSnapshot) {
          pushToHistory(debounceRef.current.pendingSnapshot)
          debounceRef.current.pendingSnapshot = null
        }
        debounceRef.current.timeoutId = null
      }, debounceMs)
    },
    [debounceMs, pushToHistory]
  )

  // Watch for form changes
  useEffect(() => {
    const snapshot = getSnapshot()
    debouncedPush(snapshot)

    const timeoutId = debounceRef.current.timeoutId
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [watchedValues, debouncedPush, getSnapshot])

  // Undo function
  const undo = useCallback(() => {
    if (historyState.past.length === 0) return

    // Clear any pending debounce
    if (debounceRef.current.timeoutId) {
      clearTimeout(debounceRef.current.timeoutId)
      debounceRef.current.timeoutId = null
    }

    const current = getSnapshot()
    const newPast = [...historyState.past]
    const previous = newPast.pop()!

    // Restore previous values
    lastSnapshotRef.current = previous
    Object.entries(previous as Record<string, unknown>).forEach(([key, value]) => {
      setValue(key as FieldPath<T>, value as T[typeof key])
    })

    // Update state
    setHistoryState({
      past: newPast,
      future: [current, ...historyState.future],
    })
  }, [historyState.past, historyState.future, getSnapshot, setValue])

  // Redo function
  const redo = useCallback(() => {
    if (historyState.future.length === 0) return

    const current = getSnapshot()
    const newFuture = [...historyState.future]
    const next = newFuture.shift()!

    // Restore next values
    lastSnapshotRef.current = next
    Object.entries(next as Record<string, unknown>).forEach(([key, value]) => {
      setValue(key as FieldPath<T>, value as T[typeof key])
    })

    // Update state
    setHistoryState({
      past: [...historyState.past, current],
      future: newFuture,
    })
  }, [historyState.past, historyState.future, getSnapshot, setValue])

  // Clear history function
  const clearHistory = useCallback(() => {
    lastSnapshotRef.current = getSnapshot()
    setHistoryState({
      past: [],
      future: [],
    })
  }, [getSnapshot])

  const value = useMemo(
    () => ({
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0,
      undo,
      redo,
      clearHistory,
      undoCount: historyState.past.length,
      redoCount: historyState.future.length,
    }),
    [historyState.past.length, historyState.future.length, undo, redo, clearHistory]
  )

  return (
    <FormUndoContext.Provider value={value}>
      {children}
    </FormUndoContext.Provider>
  )
}

/**
 * Pre-built undo/redo controls for forms using FormUndoProvider.
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const form = useForm({ defaultValues: { name: '' } })
 *
 *   return (
 *     <FormUndoProvider control={form.control}>
 *       <form>
 *         <FormUndoControls />
 *         <input {...form.register('name')} />
 *       </form>
 *     </FormUndoProvider>
 *   )
 * }
 * ```
 */
export function FormUndoControls(
  props: Omit<FormUndoRedoProps, "canUndo" | "canRedo" | "onUndo" | "onRedo">
) {
  const { canUndo, canRedo, undo, redo } = useFormUndo()

  return (
    <FormUndoRedo
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      {...props}
    />
  )
}

// ============================================================================
// Original Form Components
// ============================================================================

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = useContext(FormFieldContext)
  const itemContext = useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

function FormItem({ className, ...props }: ComponentProps<"div">) {
  const id = useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({ ...props }: ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: ComponentProps<"p">) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : props.children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}

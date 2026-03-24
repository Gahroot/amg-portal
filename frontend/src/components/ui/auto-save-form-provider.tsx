"use client";

import * as React from "react";
import {
  useForm,
  FormProvider,
  type FieldValues,
  type UseFormReturn,
  type DefaultValues,
} from "react-hook-form";
import {
  useAutoSave,
  useUnsavedChangesWarning,
  type UseAutoSaveOptions,
  type UseAutoSaveReturn,
} from "@/hooks/use-auto-save";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import { DraftRecoveryDialog } from "@/components/ui/draft-recovery-dialog";
import { cn } from "@/lib/utils";

/**
 * Props for AutoSaveFormProvider component
 */
export interface AutoSaveFormProviderProps<T extends FieldValues> {
  /** Unique identifier for this form */
  formId: string;
  /** React Hook Form instance or default values to create one */
  form?: UseFormReturn<T>;
  defaultValues?: DefaultValues<T>;
  /** Children to render */
  children: React.ReactNode | ((props: { autoSave: UseAutoSaveReturn<T> }) => React.ReactNode);
  /** Auto-save options */
  autoSaveOptions?: Omit<UseAutoSaveOptions<T>, "formId" | "initialData">;
  /** Whether to show the auto-save indicator */
  showIndicator?: boolean;
  /** Position of the auto-save indicator */
  indicatorPosition?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** Custom class name for the indicator container */
  indicatorClassName?: string;
  /** Whether to show draft recovery dialog on mount */
  enableDraftRecovery?: boolean;
  /** Callback when draft is restored */
  onDraftRestored?: (data: T) => void;
  /** Callback when draft is discarded */
  onDraftDiscarded?: () => void;
  /** Form submission handler */
  onSubmit?: (data: T) => Promise<void> | void;
}

/**
 * A comprehensive form provider that combines:
 * - React Hook Form
 * - Auto-save with local storage persistence
 * - Draft recovery
 * - Unsaved changes warning
 * - Auto-save indicator
 *
 * @example
 * ```tsx
 * <AutoSaveFormProvider
 *   formId="client-intake"
 *   defaultValues={{ name: "", email: "" }}
 *   showIndicator
 *   enableDraftRecovery
 *   onSubmit={async (data) => {
 *     await saveClient(data);
 *   }}
 * >
 *   {({ autoSave }) => (
 *     <>
 *       <FormField name="name" />
 *       <FormField name="email" />
 *       <Button type="submit">Submit</Button>
 *     </>
 *   )}
 * </AutoSaveFormProvider>
 * ```
 */
export function AutoSaveFormProvider<T extends FieldValues>({
  formId,
  form: externalForm,
  defaultValues,
  children,
  autoSaveOptions,
  showIndicator = true,
  indicatorPosition = "top-right",
  indicatorClassName,
  enableDraftRecovery = true,
  onDraftRestored,
  onDraftDiscarded,
  onSubmit,
}: AutoSaveFormProviderProps<T>) {
  // Create internal form if not provided
  const internalForm = useForm<T>({
    defaultValues,
  });
  const form = externalForm ?? internalForm;

  // Get initial data for auto-save
  const initialData = React.useMemo(() => {
    return form.getValues() as Record<string, unknown>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save hook
  const autoSave = useAutoSave<T>({
    formId,
    initialData: initialData as T,
    ...autoSaveOptions,
  });

  // Draft recovery state
  const [showRecoveryDialog, setShowRecoveryDialog] = React.useState(false);

  // Check for draft on mount
  React.useEffect(() => {
    if (enableDraftRecovery && autoSave.hasDraft()) {
      setShowRecoveryDialog(true);
    }
  }, [enableDraftRecovery, autoSave]);

  // Watch form changes and auto-save
  React.useEffect(() => {
    const subscription = form.watch((data) => {
      autoSave.save(data as T);
    });
    return () => subscription.unsubscribe();
  }, [form, autoSave]);

  // Unsaved changes warning
  useUnsavedChangesWarning(autoSave.hasUnsavedChanges);

  // Handle draft restore
  const handleRestoreDraft = () => {
    const draftData = autoSave.restoreDraft();
    if (draftData) {
      form.reset(draftData);
      onDraftRestored?.(draftData);
    }
    setShowRecoveryDialog(false);
  };

  // Handle draft discard
  const handleDiscardDraft = () => {
    autoSave.clearDraft();
    onDraftDiscarded?.();
    setShowRecoveryDialog(false);
  };

  // Handle form submission
  const handleFormSubmit = async (data: T) => {
    try {
      if (onSubmit) {
        await onSubmit(data);
      }
      // Clear draft on successful submission
      autoSave.markSubmitted();
    } catch (error) {
      // Let the parent handle the error
      throw error;
    }
  };

  // Position classes for indicator
  const positionClasses = {
    "top-right": "top-0 right-0",
    "top-left": "top-0 left-0",
    "bottom-right": "bottom-0 right-0",
    "bottom-left": "bottom-0 left-0",
  };

  return (
    <FormProvider {...form}>
      <div className="relative">
        {showIndicator && (
          <div
            className={cn(
              "absolute z-10 p-2",
              positionClasses[indicatorPosition],
              indicatorClassName
            )}
          >
            <AutoSaveIndicator
              status={autoSave.status}
              lastSaved={autoSave.lastSaved}
            />
          </div>
        )}

        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          {typeof children === "function"
            ? children({ autoSave })
            : children}
        </form>

        {enableDraftRecovery && (
          <DraftRecoveryDialog
            open={showRecoveryDialog}
            onOpenChange={setShowRecoveryDialog}
            draft={autoSave.getDraft()}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
          />
        )}
      </div>
    </FormProvider>
  );
}

export default AutoSaveFormProvider;

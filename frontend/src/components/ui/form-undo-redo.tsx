"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";

/**
 * Props for the FormUndoRedo component
 */
export interface FormUndoRedoProps {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Handler for undo action */
  onUndo: () => void;
  /** Handler for redo action */
  onRedo: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Show keyboard shortcut hints in tooltips */
  showShortcuts?: boolean;
  /** Size variant */
  size?: "default" | "sm" | "xs";
  /** Variant style */
  variant?: "default" | "outline" | "ghost";
  /** Show labels alongside icons */
  showLabels?: boolean;
  /** Whether the controls are disabled */
  disabled?: boolean;
}

/**
 * Undo/Redo control buttons for forms.
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const { undo, redo, canUndo, canRedo } = useFormUndo({ name: '', email: '' });
 *
 *   return (
 *     <div className="flex justify-between">
 *       <FormUndoRedo
 *         canUndo={canUndo}
 *         canRedo={canRedo}
 *         onUndo={undo}
 *         onRedo={redo}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function FormUndoRedo({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  className,
  showShortcuts = true,
  size = "xs",
  variant = "ghost",
  showLabels = false,
  disabled = false,
}: FormUndoRedoProps) {
  const isMac =
    typeof window !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");

  const undoShortcut = isMac ? "⌘Z" : "Ctrl+Z";
  const redoShortcut = isMac ? "⌘⇧Z" : "Ctrl+Shift+Z";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size === "xs" ? "icon-xs" : size === "sm" ? "icon-sm" : "icon"}
            onClick={onUndo}
            disabled={disabled || !canUndo}
            aria-label="Undo"
            className={cn(
              !canUndo && "opacity-50"
            )}
          >
            <Undo2 className="size-4" />
            {showLabels && <span className="ml-1">Undo</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex items-center gap-2">
            <span>Undo</span>
            {showShortcuts && (
              <Kbd className="text-[10px]">{undoShortcut}</Kbd>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size === "xs" ? "icon-xs" : size === "sm" ? "icon-sm" : "icon"}
            onClick={onRedo}
            disabled={disabled || !canRedo}
            aria-label="Redo"
            className={cn(
              !canRedo && "opacity-50"
            )}
          >
            <Redo2 className="size-4" />
            {showLabels && <span className="ml-1">Redo</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex items-center gap-2">
            <span>Redo</span>
            {showShortcuts && (
              <Kbd className="text-[10px]">{redoShortcut}</Kbd>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Props for FormUndoRedoProvider - wraps a form and provides keyboard shortcuts
 */
export interface FormUndoRedoProviderProps {
  children: ReactNode;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Handler for undo action */
  onUndo: () => void;
  /** Handler for redo action */
  onRedo: () => void;
  /** Whether shortcuts are enabled */
  enabled?: boolean;
}

/**
 * Provider component that handles keyboard shortcuts for undo/redo.
 * Wrap your form with this to enable Ctrl+Z / Ctrl+Y shortcuts.
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const undoState = useFormUndo({ name: '' });
 *
 *   return (
 *     <FormUndoRedoProvider {...undoState}>
 *       <form>
 *         <input value={undoState.value.name} ... />
 *       </form>
 *     </FormUndoRedoProvider>
 *   );
 * }
 * ```
 */
export function FormUndoRedoProvider({
  children,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  enabled = true,
}: FormUndoRedoProviderProps) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      // Check for Ctrl/Cmd + Z (undo)
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        // Don't interfere with browser's native undo in text inputs
        const target = event.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        // If we're in an input, let the browser handle it unless we want to override
        if (isInput) {
          // For custom undo in inputs, we can handle it here
          // For now, let the browser's native undo work in inputs
          return;
        }

        if (canUndo) {
          event.preventDefault();
          onUndo();
        }
      }

      // Check for Ctrl/Cmd + Shift + Z or Ctrl + Y (redo)
      if (
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "z") ||
        ((event.ctrlKey || event.metaKey) && event.key === "y")
      ) {
        const target = event.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (isInput) {
          return;
        }

        if (canRedo) {
          event.preventDefault();
          onRedo();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, canUndo, canRedo, onUndo, onRedo]);

  return <>{children}</>;
}

/**
 * Combined component that provides both UI controls and keyboard shortcuts
 */
export interface FormUndoRedoWithShortcutsProps extends FormUndoRedoProps {
  /** Whether keyboard shortcuts are enabled */
  shortcutsEnabled?: boolean;
}

export function FormUndoRedoWithShortcuts({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  shortcutsEnabled = true,
  ...props
}: FormUndoRedoWithShortcutsProps) {
  return (
    <FormUndoRedoProvider
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
      enabled={shortcutsEnabled}
    >
      <FormUndoRedo
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        {...props}
      />
    </FormUndoRedoProvider>
  );
}

/**
 * Hook to get undo/redo keyboard shortcut handlers
 * Use this when you want to handle shortcuts manually
 */
export function useUndoRedoShortcuts(
  canUndo: boolean,
  canRedo: boolean,
  onUndo: () => void,
  onRedo: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Undo: Ctrl/Cmd + Z
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        if (!isInput && canUndo) {
          event.preventDefault();
          onUndo();
        }
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl + Y
      if (
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "z") ||
        ((event.ctrlKey || event.metaKey) && event.key === "y")
      ) {
        if (!isInput && canRedo) {
          event.preventDefault();
          onRedo();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, canUndo, canRedo, onUndo, onRedo]);
}

export default FormUndoRedo;

"use client";

import { useCallback } from "react";
import type { MouseEvent, ReactNode } from "react";
import {
  useFocusMode as useFocusModeBase,
  FocusModeProvider as BaseFocusModeProvider,
} from "@/hooks/use-focus-mode";

// Re-export for convenience
export { useFocusMode } from "@/hooks/use-focus-mode";

interface FocusModeOverlayProps {
  /** Content to show in the overlay (usually exit button) */
  children?: ReactNode;
  /** Callback when clicking outside content to exit */
  onExit?: () => void;
}

/**
 * Overlay component that dims non-essential elements in focus mode
 * Click outside content to exit focus mode
 */
export function FocusModeOverlay({
  children,
  onExit,
}: FocusModeOverlayProps) {
  const { isFocusMode, disableFocusMode } = useFocusModeBase();

  const handleBackdropClick = useCallback(
    (event: MouseEvent) => {
      // Only trigger if clicking the backdrop itself, not children
      if (event.target === event.currentTarget) {
        (onExit ?? disableFocusMode)();
      }
    },
    [onExit, disableFocusMode]
  );

  if (!isFocusMode) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/**
 * Exit button shown in focus mode
 */
export function FocusModeExitButton() {
  const { isFocusMode, disableFocusMode } = useFocusModeBase();

  if (!isFocusMode) return null;

  return (
    <button
      onClick={disableFocusMode}
      className="fixed top-4 right-4 z-[60] rounded-lg bg-background px-3 py-2 text-sm font-medium shadow-lg border transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      aria-label="Exit focus mode"
    >
      Exit Focus Mode
      <span className="ml-2 text-muted-foreground text-xs">Esc</span>
    </button>
  );
}

/**
 * Combined provider with overlay functionality
 */
export function FocusModeProvider({ children }: { children: ReactNode }) {
  return (
    <BaseFocusModeProvider>
      {children}
      <FocusModeOverlay>
        <FocusModeExitButton />
      </FocusModeOverlay>
    </BaseFocusModeProvider>
  );
}

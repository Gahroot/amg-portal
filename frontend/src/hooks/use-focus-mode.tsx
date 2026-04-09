"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
interface FocusModeState {
  /** Whether focus mode is currently active */
  isFocusMode: boolean;
  /** Toggle focus mode on/off */
  toggleFocusMode: () => void;
  /** Enable focus mode */
  enableFocusMode: () => void;
  /** Disable focus mode */
  disableFocusMode: () => void;
}

const FocusModeContext = createContext<FocusModeState | null>(null);

/**
 * Hook to access focus mode state
 * Must be used within a FocusModeProvider
 */
export function useFocusMode(): FocusModeState {
  const context = useContext(FocusModeContext);
  if (!context) {
    throw new Error("useFocusMode must be used within a FocusModeProvider");
  }
  return context;
}

interface FocusModeProviderProps {
  children: ReactNode;
}

/**
 * Provider for focus mode state
 * Focus mode is per-session (not persisted) for distraction-free viewing
 */
export function FocusModeProvider({ children }: FocusModeProviderProps) {
  // Per-session state - not persisted to localStorage
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Handle Escape key to exit focus mode
  useEffect(() => {
    if (!isFocusMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocusMode]);

  // Lock body scroll when in focus mode
  useEffect(() => {
    if (isFocusMode) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFocusMode]);

  // Add class to document element for global styling
  useEffect(() => {
    if (isFocusMode) {
      document.documentElement.classList.add("focus-mode");
      return () => {
        document.documentElement.classList.remove("focus-mode");
      };
    }
  }, [isFocusMode]);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  const enableFocusMode = useCallback(() => {
    setIsFocusMode(true);
  }, []);

  const disableFocusMode = useCallback(() => {
    setIsFocusMode(false);
  }, []);

  const value = useMemo(
    () => ({
      isFocusMode,
      toggleFocusMode,
      enableFocusMode,
      disableFocusMode,
    }),
    [isFocusMode, toggleFocusMode, enableFocusMode, disableFocusMode]
  );

  return (
    <FocusModeContext.Provider value={value}>
      {children}
    </FocusModeContext.Provider>
  );
}

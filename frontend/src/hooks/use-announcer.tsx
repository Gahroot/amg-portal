"use client";

import * as React from "react";

export type Politeness = "polite" | "assertive" | "off";

interface AnnouncerOptions {
  /** Default politeness level for announcements */
  defaultPoliteness?: Politeness;
  /** Delay in ms before clearing the message (for screen readers to finish reading) */
  clearDelay?: number;
}

interface AnnouncerState {
  message: string;
  politeness: Politeness;
}

const ANNOUNCER_ID = "sr-announcer";
const CLEAR_DELAY_DEFAULT = 500;

/**
 * Hook for announcing messages to screen readers using ARIA live regions.
 * Provides methods for polite and assertive announcements.
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
 *
 * @example
 * const { announce, polite, assertive } = useAnnouncer();
 *
 * // Polite announcement (waits for user to finish current action)
 * polite("Item saved successfully");
 *
 * // Assertive announcement (interrupts immediately)
 * assertive("Error: Form validation failed");
 *
 * // Custom politeness
 * announce("Processing...", "polite");
 */
export function useAnnouncer(options: AnnouncerOptions = {}) {
  const { defaultPoliteness = "polite", clearDelay = CLEAR_DELAY_DEFAULT } =
    options;

  const [state, setState] = React.useState<AnnouncerState>({
    message: "",
    politeness: defaultPoliteness,
  });

  const clearTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Clear any pending timeout
  const clearPendingTimeout = React.useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
  }, []);

  // Announce a message with specified politeness
  const announce = React.useCallback(
    (message: string, politeness: Politeness = defaultPoliteness) => {
      clearPendingTimeout();

      // Clear first to ensure the same message can be announced again
      setState({ message: "", politeness });

      // Use requestAnimationFrame to ensure the clear happens before new message
      requestAnimationFrame(() => {
        setState({ message, politeness });

        // Auto-clear after delay
        clearTimeoutRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, message: "" }));
        }, clearDelay);
      });
    },
    [defaultPoliteness, clearDelay, clearPendingTimeout]
  );

  // Convenience methods
  const polite = React.useCallback(
    (message: string) => announce(message, "polite"),
    [announce]
  );

  const assertive = React.useCallback(
    (message: string) => announce(message, "assertive"),
    [announce]
  );

  // Clear current announcement
  const clear = React.useCallback(() => {
    clearPendingTimeout();
    setState((prev) => ({ ...prev, message: "" }));
  }, [clearPendingTimeout]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => clearPendingTimeout();
  }, [clearPendingTimeout]);

  return {
    /** Current announcement state */
    state,
    /** Announce with custom politeness */
    announce,
    /** Polite announcement (non-interrupting) */
    polite,
    /** Assertive announcement (interrupting) */
    assertive,
    /** Clear current announcement */
    clear,
    /** ID for the announcer element */
    announcerId: ANNOUNCER_ID,
  };
}

interface AnnouncerProps {
  /** Announce context from useAnnouncer hook */
  state: AnnouncerState;
  /** Optional className for the announcer element */
  className?: string;
}

/**
 * Screen reader announcer component.
 * Renders an ARIA live region for announcing dynamic content changes.
 *
 * @example
 * const announcer = useAnnouncer();
 *
 * return (
 *   <>
 *     <Announcer state={announcer.state} />
 *     <button onClick={() => announcer.polite("Saved!")}>Save</button>
 *   </>
 * );
 */
export function Announcer({ state, className }: AnnouncerProps) {
  const { message, politeness } = state;

  return (
    <div
      id={ANNOUNCER_ID}
      role="status"
      aria-live={politeness === "off" ? "off" : politeness}
      aria-atomic="true"
      className={className ?? "sr-only"}
      data-slot="sr-announcer"
    >
      {message}
    </div>
  );
}

/**
 * Provider component that manages announcements globally.
 * Use this at the app root level for app-wide screen reader announcements.
 *
 * @example
 * // In layout or _app.tsx
 * <AnnouncerProvider>
 *   <App />
 * </AnnouncerProvider>
 *
 * // In any component
 * const { polite } = useGlobalAnnouncer();
 * polite("Item added to cart");
 */

interface AnnouncerContextValue {
  announce: (message: string, politeness?: Politeness) => void;
  polite: (message: string) => void;
  assertive: (message: string) => void;
  clear: () => void;
}

const AnnouncerContext = React.createContext<AnnouncerContextValue | null>(
  null
);

export function useGlobalAnnouncer() {
  const context = React.useContext(AnnouncerContext);
  if (!context) {
    throw new Error(
      "useGlobalAnnouncer must be used within an AnnouncerProvider"
    );
  }
  return context;
}

export function AnnouncerProvider({
  children,
  defaultPoliteness = "polite",
  clearDelay = 500,
}: {
  children: React.ReactNode;
  defaultPoliteness?: Politeness;
  clearDelay?: number;
}) {
  const announcer = useAnnouncer({ defaultPoliteness, clearDelay });

  const value = React.useMemo(
    () => ({
      announce: announcer.announce,
      polite: announcer.polite,
      assertive: announcer.assertive,
      clear: announcer.clear,
    }),
    [announcer.announce, announcer.polite, announcer.assertive, announcer.clear]
  );

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <Announcer state={announcer.state} />
    </AnnouncerContext.Provider>
  );
}

export { useAnnouncer as default };

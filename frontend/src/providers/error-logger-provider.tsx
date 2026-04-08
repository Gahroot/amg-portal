"use client";

import { useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { recordClick, recordNavigation, getActionContext } from "@/lib/action-context";
import type { AxiosError } from "axios";

interface ErrorEntry {
  type: string;
  message: string;
  stack?: string;
  url?: string;
  method?: string;
  status?: number;
  responseBody?: string;
  componentStack?: string;
  source?: string;
  pageUrl?: string;
  timestamp: string;
  trigger?: string;
  goal?: string;
  breadcrumbs?: string[];
}

// Batch errors to avoid hammering the endpoint
const FLUSH_INTERVAL = 2000;

export function ErrorLoggerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queueRef = useRef<ErrorEntry[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (queueRef.current.length === 0) return;
    const batch = [...queueRef.current];
    queueRef.current = [];

    // Use fetch directly to avoid triggering our axios interceptors
    fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    }).catch(() => {
      // silently fail — don't cause more errors
    });
  }, []);

  const enqueue = useCallback(
    (entry: Omit<ErrorEntry, "timestamp" | "pageUrl" | "trigger" | "goal" | "breadcrumbs">) => {
      const { trigger, goal, breadcrumbs } = getActionContext();

      queueRef.current.push({
        ...entry,
        timestamp: new Date().toISOString(),
        pageUrl: typeof window !== "undefined" ? window.location.href : "unknown",
        ...(trigger ? { trigger } : {}),
        ...(goal ? { goal } : {}),
        ...(breadcrumbs.length > 0 ? { breadcrumbs } : {}),
      });

      // Auto-flush after interval
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          flush();
        }, FLUSH_INTERVAL);
      }
    },
    [flush]
  );

  useEffect(() => {
    // ── Action context listeners ────────────────────────────────────────────

    // Capture-phase click listener fires even when children call stopPropagation
    const onCapturingClick = (event: MouseEvent) => {
      if (event.target instanceof Element) {
        recordClick(event.target);
      }
    };

    const onPopState = () => recordNavigation(window.location.href);
    const onHashChange = () => recordNavigation(window.location.href);

    document.addEventListener("click", onCapturingClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);

    // ── Error listeners ─────────────────────────────────────────────────────

    // 1. Unhandled errors
    const onError = (event: ErrorEvent) => {
      enqueue({
        type: "UNHANDLED_ERROR",
        message: event.message || "Unknown error",
        stack: event.error?.stack,
        source: `${event.filename}:${event.lineno}:${event.colno}`,
      });
    };

    // 2. Unhandled promise rejections
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      enqueue({
        type: "UNHANDLED_PROMISE_REJECTION",
        message:
          reason?.message || (typeof reason === "string" ? reason : "Promise rejected"),
        stack: reason?.stack,
      });
    };

    // 3. Console.error interception
    const originalConsoleError = console.error;
    const seenMessages = new Set<string>();

    console.error = (...args: unknown[]) => {
      // Always pass through to original
      originalConsoleError.apply(console, args);

      const message = args
        .map((a) => {
          if (a instanceof Error) return `${a.message}\n${a.stack}`;
          if (typeof a === "object") {
            try {
              return JSON.stringify(a, null, 2);
            } catch {
              return String(a);
            }
          }
          return String(a);
        })
        .join(" ");

      // Deduplicate within a short window
      const key = message.slice(0, 200);
      if (seenMessages.has(key)) return;
      seenMessages.add(key);
      setTimeout(() => seenMessages.delete(key), 5000);

      // Skip our own logging noise
      if (message.includes("/api/error-log")) return;

      enqueue({
        type: "CONSOLE_ERROR",
        message: message.slice(0, 5000),
      });
    };

    // 4. Toast interception (error + warning)
    const originalToastError = toast.error.bind(toast);
    const originalToastWarning = toast.warning.bind(toast);

    const interceptToast = (level: "TOAST_ERROR" | "TOAST_WARNING") =>
      (...args: Parameters<typeof toast.error>) => {
        const [message, data] = args;
        const text =
          typeof message === "string"
            ? message
            : (message as { toString?: () => string })?.toString?.() ?? "Unknown toast";
        const description =
          data?.description && typeof data.description === "string"
            ? ` — ${data.description}`
            : "";
        enqueue({ type: level, message: `${text}${description}`.slice(0, 5000) });
        return level === "TOAST_ERROR"
          ? originalToastError(...args)
          : originalToastWarning(...args);
      };

    toast.error = interceptToast("TOAST_ERROR");
    toast.warning = interceptToast("TOAST_WARNING");

    // 5. Axios interceptor for network failures (4xx/5xx)
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Skip the error-log endpoint itself
        const url = error.config?.url || "";
        if (url.includes("/api/error-log")) return Promise.reject(error);

        let responseBody: string | undefined;
        try {
          responseBody =
            typeof error.response?.data === "string"
              ? error.response.data.slice(0, 2000)
              : JSON.stringify(error.response?.data, null, 2)?.slice(0, 2000);
        } catch {
          responseBody = undefined;
        }

        enqueue({
          type: "NETWORK_ERROR",
          message: error.message || "Network request failed",
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          responseBody,
          stack: error.stack,
        });

        return Promise.reject(error);
      }
    );

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      document.removeEventListener("click", onCapturingClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      console.error = originalConsoleError;
      toast.error = originalToastError;
      toast.warning = originalToastWarning;
      api.interceptors.response.eject(interceptorId);
      // Flush remaining
      flush();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [enqueue, flush]);

  return <>{children}</>;
}

"use client";

import * as React from "react";
import { OctagonXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "REACT_CRASH",
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        pageUrl: typeof window !== "undefined" ? window.location.href : "unknown",
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[50vh] items-center justify-center bg-[#FDFBF7] p-8">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <OctagonXIcon className="h-5 w-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {process.env.NODE_ENV === "development"
                  ? this.state.error?.message || "An unexpected error occurred"
                  : "An unexpected error occurred. Please try again."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    this.setState({ hasError: false });
                    window.location.reload();
                  }}
                >
                  Try Again
                </Button>
                {SUPPORT_EMAIL && (
                  <Button variant="outline" asChild>
                    <a href={`mailto:${SUPPORT_EMAIL}`}>Email Support</a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

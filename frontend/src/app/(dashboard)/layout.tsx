"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorBoundary } from "@/components/error/error-boundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <AuthGuard>{children}</AuthGuard>
    </ErrorBoundary>
  );
}

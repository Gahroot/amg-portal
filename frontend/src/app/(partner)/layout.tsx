"use client";

import { useAuth } from "@/providers/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (user && user.role !== "partner") {
    router.replace("/");
    return null;
  }

  return (
    <AuthGuard>
      <ErrorBoundary>
        <div className="min-h-screen bg-white">
          <nav className="border-b px-6 py-4 flex items-center justify-between">
            <span className="font-serif text-xl font-bold tracking-tight">
              AMG Partner Portal
            </span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.full_name}
              </span>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          </nav>
          <main className="p-6">{children}</main>
        </div>
      </ErrorBoundary>
    </AuthGuard>
  );
}

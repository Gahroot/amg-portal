"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated (after initial load completes)
  // This runs during render to avoid a blank flash before useEffect fires
  if (!isLoading && !isAuthenticated) {
    router.replace("/login");
  }

  // Show loading skeleton while loading OR during redirect to prevent flash
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground font-mono text-sm">
          Loading...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

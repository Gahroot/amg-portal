"use client";

import { useAuth } from "@/providers/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { portalNavConfig } from "@/config/portal-nav";
import { useRouter } from "next/navigation";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();

  if (user && user.role !== "client") {
    router.replace("/");
    return null;
  }

  return (
    <AuthGuard>
      <ErrorBoundary>
        <SidebarProvider>
          <AppSidebar config={portalNavConfig} />
          <SidebarInset>
            <header className="flex h-14 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-6" />
              <div className="flex-1" />
              <NotificationBell />
            </header>
            <main className="flex-1 p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </ErrorBoundary>
    </AuthGuard>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorBoundary } from "@/components/error/error-boundary";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import {
  KeyboardShortcutsDialogProvider,
  useKeyboardShortcutsDialog,
} from "@/components/ui/keyboard-shortcuts-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { portalNavConfig } from "@/config/portal-nav";
import { useWebSocket } from "@/hooks/use-websocket";
import { PulseSurveyContainer } from "@/components/portal/pulse-survey-popup";
import { SkipLinks } from "@/components/layout/skip-link";
import { AnnouncerProvider } from "@/hooks/use-announcer";
import { QuickActionsProvider } from "@/providers/quick-actions-provider";
import { QuickActionsMenu } from "@/components/common/quick-actions-menu";
import { HelpPanel, HelpButton } from "@/components/help/help-panel";

function PortalKeyboardShortcuts() {
  const { toggleSidebar } = useSidebar();
  const { open: openShortcutsDialog } = useKeyboardShortcutsDialog();
  const router = useRouter();

  useKeyboardShortcuts({
    onShowShortcuts: openShortcutsDialog,
    onToggleSidebar: toggleSidebar,
    onFocusSearch: () => {
      // For portal, focus search could scroll to top or focus a search input if available
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onNewItem: () => {
      // For portal clients, maybe navigate to a relevant page
      // This is context-dependent
    },
  });

  return null;
}

function PortalContent({ children }: { children: React.ReactNode }) {
  useWebSocket();
  const [helpPanelOpen, setHelpPanelOpen] = React.useState(false);
  return (
    <QuickActionsProvider>
      <KeyboardShortcutsDialogProvider>
        <AnnouncerProvider>
          {/* Skip links for keyboard navigation */}
          <SkipLinks />

          <SidebarProvider>
            {/* Navigation landmark with accessible name */}
            <nav aria-label="Portal navigation" id="sidebar-navigation">
              <AppSidebar config={portalNavConfig} />
            </nav>

            <SidebarInset>
              {/* Banner landmark for header */}
              <header
                className="flex h-14 items-center gap-2 border-b px-4"
                role="banner"
              >
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-6" />
                <Breadcrumbs portal="portal" />
                <div className="flex-1" />
                <HelpButton onClick={() => setHelpPanelOpen(true)} />
                <NotificationBell />
              </header>

              {/* Main content landmark */}
              <main
                id="main-content"
                className="flex-1 p-6"
                role="main"
                tabIndex={-1}
                aria-label="Main content"
              >
                {children}
              </main>
            </SidebarInset>

            <PortalKeyboardShortcuts />
            <PulseSurveyContainer />
            <QuickActionsMenu />
            <HelpPanel open={helpPanelOpen} onOpenChange={setHelpPanelOpen} />
          </SidebarProvider>
        </AnnouncerProvider>
      </KeyboardShortcutsDialogProvider>
    </QuickActionsProvider>
  );
}

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
        <PortalContent>{children}</PortalContent>
      </ErrorBoundary>
    </AuthGuard>
  );
}

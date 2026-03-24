"use client";

import { useMemo, useState } from "react";
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
import { partnerNavConfig } from "@/config/partner-nav";
import { useWebSocket } from "@/hooks/use-websocket";
import { usePartnerOnboarding } from "@/hooks/use-partner-portal";
import { QuickActionsProvider } from "@/providers/quick-actions-provider";
import { QuickActionsMenu } from "@/components/common/quick-actions-menu";
import { HelpPanel, HelpButton } from "@/components/help/help-panel";
import type { PortalNavConfig } from "@/types/navigation";

function useFilteredPartnerNav(): PortalNavConfig {
  const { data: onboarding } = usePartnerOnboarding();
  const onboardingCompleted = onboarding?.current_stage === "completed";

  return useMemo(() => {
    if (!onboardingCompleted) return partnerNavConfig;

    return {
      ...partnerNavConfig,
      groups: partnerNavConfig.groups.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.href !== "/partner/onboarding"),
      })),
    };
  }, [onboardingCompleted]);
}

function PartnerKeyboardShortcuts() {
  const { toggleSidebar } = useSidebar();
  const { open: openShortcutsDialog } = useKeyboardShortcutsDialog();

  useKeyboardShortcuts({
    onShowShortcuts: openShortcutsDialog,
    onToggleSidebar: toggleSidebar,
    onFocusSearch: () => {
      // For partner portal, scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  return null;
}

function PartnerContent({ children }: { children: React.ReactNode }) {
  useWebSocket();
  const navConfig = useFilteredPartnerNav();
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  return (
    <QuickActionsProvider>
      <KeyboardShortcutsDialogProvider>
        <SidebarProvider>
          <AppSidebar config={navConfig} />
          <SidebarInset>
            <header className="flex h-14 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-6" />
              <Breadcrumbs portal="partner" />
              <div className="flex-1" />
              <HelpButton onClick={() => setHelpPanelOpen(true)} />
              <NotificationBell />
            </header>
            <main className="flex-1 p-6">{children}</main>
          </SidebarInset>
          <PartnerKeyboardShortcuts />
          <QuickActionsMenu />
          <HelpPanel open={helpPanelOpen} onOpenChange={setHelpPanelOpen} />
        </SidebarProvider>
      </KeyboardShortcutsDialogProvider>
    </QuickActionsProvider>
  );
}

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();

  if (user && user.role !== "partner") {
    router.replace("/");
    return null;
  }

  return (
    <AuthGuard>
      <ErrorBoundary>
        <PartnerContent>{children}</PartnerContent>
      </ErrorBoundary>
    </AuthGuard>
  );
}

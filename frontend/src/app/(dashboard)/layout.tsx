"use client";

import * as React from "react";
import { Suspense } from "react";
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
import { CommandPalette } from "@/components/navigation/command-palette";
import {
  KeyboardShortcutsDialogProvider,
  useKeyboardShortcutsDialog,
} from "@/components/ui/keyboard-shortcuts-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { dashboardNavConfig } from "@/config/dashboard-nav";
import { useWebSocket } from "@/hooks/use-websocket";
import { QuickTaskButton } from "@/components/tasks/quick-task-button";
import { SkipLinks } from "@/components/layout/skip-link";
import { AnnouncerProvider } from "@/hooks/use-announcer";
import { QuickActionsProvider } from "@/providers/quick-actions-provider";
import { QuickActionsMenu } from "@/components/common/quick-actions-menu";
import { QuickActionsBar } from "@/components/layout/quick-actions-bar";
import { HelpPanel, HelpButton } from "@/components/help/help-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TourManager } from "@/components/tours";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { FocusModeProvider, useFocusMode } from "@/providers/focus-mode-provider";
import { FocusModeToggle } from "@/components/layout/focus-mode-toggle";
import {
  SplitViewProvider,
  useSplitView,
} from "@/hooks/use-split-view";
import {
  SplitViewContainer,
  SplitViewToggle,
} from "@/components/layout/split-view-toggle";
import { cn } from "@/lib/utils";

function DashboardKeyboardShortcuts() {
  const { toggleSidebar } = useSidebar();
  const { open: openShortcutsDialog } = useKeyboardShortcutsDialog();
  const { toggleFocusMode } = useFocusMode();
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

  useKeyboardShortcuts({
    onShowShortcuts: openShortcutsDialog,
    onToggleSidebar: toggleSidebar,
    onOpenCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onFocusSearch: () => {
      // Focus the command palette input
      setCommandPaletteOpen(true);
    },
    onNewItem: () => {
      // Context-aware new item - for dashboard, default to new program
      // This could be enhanced to be context-aware based on current route
      window.location.href = "/programs/new";
    },
    onToggleFocusMode: toggleFocusMode,
  });

  return (
    <CommandPalette
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
    />
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  useWebSocket();
  const [helpPanelOpen, setHelpPanelOpen] = React.useState(false);
  const { isFocusMode } = useFocusMode();
  const { isSplitView } = useSplitView();

  return (
    <QuickActionsProvider>
      <KeyboardShortcutsDialogProvider>
        <TooltipProvider>
          <AnnouncerProvider>
            {/* Skip links for keyboard navigation */}
            <SkipLinks />

            {/* Tour manager for guided tours */}
            <TourManager />

            <SidebarProvider>
              {/* Navigation landmark with accessible name - hidden in focus mode */}
              {!isFocusMode && (
                <nav aria-label="Main navigation" id="sidebar-navigation" data-tour="sidebar">
                  <AppSidebar config={dashboardNavConfig} showAlerts />
                </nav>
              )}

              <SidebarInset
                className={cn(
                  isFocusMode && "transition-all duration-300"
                )}
              >
                {/* Banner landmark for header - simplified in focus mode */}
                <header
                  className={cn(
                    "flex h-14 items-center gap-2 border-b px-4 transition-all duration-300",
                    isFocusMode && "h-12 border-b-0 bg-transparent"
                  )}
                  role="banner"
                  data-tour="header"
                >
                  {!isFocusMode && (
                    <>
                      <span data-tour="sidebar-trigger">
                        <SidebarTrigger />
                      </span>
                      <Separator orientation="vertical" className="h-6" />
                      <span data-tour="breadcrumbs">
                        <Breadcrumbs portal="dashboard" />
                      </span>
                      <div className="flex-1" />
                      {/* Split view toggle - shown when in split mode */}
                      <SplitViewToggle />
                      <span data-tour="help-button">
                        <HelpButton onClick={() => setHelpPanelOpen(true)} />
                      </span>
                      <span data-tour="notification-bell">
                        <NotificationBell />
                      </span>
                    </>
                  )}
                  {/* Focus mode toggle - always visible */}
                  <div className={cn(
                    "flex items-center",
                    isFocusMode ? "absolute right-4 top-3 z-50" : ""
                  )}>
                    <FocusModeToggle />
                  </div>
                </header>

                {/* Main content landmark - maximized in focus mode */}
                <main
                  id="main-content"
                  className={cn(
                    "flex-1 transition-all duration-300",
                    !isSplitView && "p-6",
                    isFocusMode && "p-4 md:p-8 lg:p-12 max-w-5xl mx-auto w-full",
                    isSplitView && "overflow-hidden"
                  )}
                  role="main"
                  tabIndex={-1}
                  aria-label="Main content"
                  data-tour="dashboard"
                >
                  {/* Wrap in SplitViewContainer for split view support */}
                  <SplitViewContainer className={cn(isSplitView && "h-full -m-6")}>
                    {children}
                  </SplitViewContainer>
                </main>
              </SidebarInset>

              <DashboardKeyboardShortcuts />
              
              {/* Floating elements - hidden in focus mode */}
              {!isFocusMode && (
                <>
                  <span data-tour="quick-task-button">
                    <QuickTaskButton />
                  </span>
                  <span data-tour="quick-actions">
                    <QuickActionsMenu />
                  </span>
                  {/* Quick Actions Bar - Keyboard accessible action bar */}
                  <QuickActionsBar
                    position="bottom-center"
                    mode="auto"
                    maxActions={6}
                    showLabels={true}
                    allowCustomization={true}
                  />
                </>
              )}
              <HelpPanel open={helpPanelOpen} onOpenChange={setHelpPanelOpen} />
              {!isFocusMode && <FeedbackWidget />}
            </SidebarProvider>
          </AnnouncerProvider>
        </TooltipProvider>
      </KeyboardShortcutsDialogProvider>
    </QuickActionsProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <AuthGuard>
        <FocusModeProvider>
          <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <SplitViewProvider syncWithUrl={true}>
              <DashboardContent>{children}</DashboardContent>
            </SplitViewProvider>
          </Suspense>
        </FocusModeProvider>
      </AuthGuard>
    </ErrorBoundary>
  );
}

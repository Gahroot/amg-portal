/**
 * New User Onboarding Tour
 *
 * This tour introduces new users to the AMG Portal interface, covering:
 * - Navigation sidebar
 * - Header actions
 * - Quick actions
 * - Help resources
 */

import { LayoutDashboard } from "lucide-react";
import type { TourDefinition } from "@/lib/tours/config";
import { registerTour } from "@/lib/tours/config";

export const onboardingTourId = "onboarding";

export const onboardingTour: TourDefinition = {
  id: onboardingTourId,
  name: "Welcome to AMG Portal",
  description: "Get started with the basics of navigating and using the portal",
  category: "onboarding",
  estimatedTime: "3 min",
  icon: LayoutDashboard,
  featured: true,
  order: 1,
  autoStart: true,
  route: "/",
  startRoutes: ["/", "/dashboard"],
  steps: [
    {
      id: "welcome",
      selector: "body",
      title: "Welcome to AMG Portal! 👋",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Welcome to the AMG Portal! This quick tour will help you get familiar
            with the interface and key features.
          </p>
          <p className="text-sm text-muted-foreground">
            Click <strong>Next</strong> to continue or <strong>Skip</strong> to explore on your own.
          </p>
        </div>
      ),
      position: "center",
      disableInteraction: true,
    },
    {
      id: "sidebar",
      selector: "[data-tour='sidebar']",
      title: "Navigation Sidebar",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            The sidebar is your main navigation hub. Here you can access:
          </p>
          <ul className="list-disc pl-4 text-sm space-y-1 text-muted-foreground">
            <li>Dashboard overview</li>
            <li>Clients and their programs</li>
            <li>Partner management</li>
            <li>Reports and analytics</li>
            <li>Settings</li>
          </ul>
        </div>
      ),
      position: "right",
      padding: 8,
    },
    {
      id: "sidebar-collapsed",
      selector: "[data-tour='sidebar-trigger']",
      title: "Collapse the Sidebar",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Click this button to collapse or expand the sidebar.
            This gives you more screen space when you need it.
          </p>
          <p className="text-xs text-muted-foreground">
            💡 Tip: Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘ B</kbd> (Mac) or{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl B</kbd> (Windows) as a shortcut.
          </p>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "header",
      selector: "[data-tour='header']",
      title: "Header Actions",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            The header contains quick access to important features:
          </p>
          <ul className="list-disc pl-4 text-sm space-y-1 text-muted-foreground">
            <li>Breadcrumbs for navigation</li>
            <li>Help center</li>
            <li>Notifications</li>
          </ul>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "help-button",
      selector: "[data-tour='help-button']",
      title: "Get Help Anytime",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Click the help button to open contextual help for the current page.
            You&apos;ll find guides, FAQs, and can contact support.
          </p>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "notifications",
      selector: "[data-tour='notification-bell']",
      title: "Stay Updated",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            The notification bell shows your recent notifications.
            A badge indicates unread items that need your attention.
          </p>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "command-palette",
      selector: "[data-tour='command-palette-trigger']",
      title: "Quick Navigation",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Use the command palette for quick navigation and actions.
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘ K</kbd> (Mac) or{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl K</kbd> (Windows)
            {" "}to open it.
          </p>
          <p className="text-xs text-muted-foreground">
            Search for pages, run commands, and navigate without using the mouse.
          </p>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "quick-task",
      selector: "[data-tour='quick-task-button']",
      title: "Create New Items",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Use the quick action button to create new programs, clients,
            or other items from anywhere in the application.
          </p>
        </div>
      ),
      position: "left",
      padding: 8,
    },
    {
      id: "complete",
      selector: "body",
      title: "You&apos;re All Set! 🎉",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            You&apos;re ready to start using AMG Portal! Here are some next steps:
          </p>
          <ul className="list-disc pl-4 text-sm space-y-1 text-muted-foreground">
            <li>Explore your dashboard</li>
            <li>View your active programs</li>
            <li>Check out the help panel for more guides</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-2">
            You can restart this tour anytime from the Help menu.
          </p>
        </div>
      ),
      position: "center",
      disableInteraction: true,
    },
  ],
};

// Auto-register this tour
registerTour(onboardingTour);

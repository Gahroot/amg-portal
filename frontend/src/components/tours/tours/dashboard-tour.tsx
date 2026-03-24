/**
 * Dashboard Tour
 *
 * This tour guides users through the dashboard features:
 * - Dashboard widgets and stats
 * - Quick actions
 * - Recent items
 */

import { LayoutDashboard } from "lucide-react";
import type { TourDefinition } from "@/lib/tours/config";
import { registerTour } from "@/lib/tours/config";

export const dashboardTourId = "dashboard";

export const dashboardTour: TourDefinition = {
  id: dashboardTourId,
  name: "Dashboard Overview",
  description: "Learn how to use the dashboard to monitor your programs and tasks",
  category: "pages",
  estimatedTime: "2 min",
  icon: LayoutDashboard,
  featured: true,
  order: 10,
  route: "/",
  startRoutes: ["/", "/dashboard"],
  steps: [
    {
      id: "welcome",
      selector: "[data-tour='dashboard']",
      title: "Your Dashboard",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            The dashboard gives you an at-a-glance view of your most important
            metrics and activities.
          </p>
        </div>
      ),
      position: "right",
      padding: 8,
    },
    {
      id: "stats-cards",
      selector: "[data-tour='dashboard-stats']",
      title: "Key Metrics",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            These cards show your key performance indicators:
          </p>
          <ul className="list-disc pl-4 text-sm space-y-1 text-muted-foreground">
            <li>Active programs count</li>
            <li>Pending tasks</li>
            <li>Upcoming deadlines</li>
            <li>Recent activity</li>
          </ul>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "recent-activity",
      selector: "[data-tour='recent-activity']",
      title: "Recent Activity",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Stay up-to-date with the latest changes across your programs.
            This feed shows recent updates, approvals, and comments.
          </p>
        </div>
      ),
      position: "top",
      padding: 8,
    },
    {
      id: "upcoming-deadlines",
      selector: "[data-tour='upcoming-deadlines']",
      title: "Upcoming Deadlines",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Never miss a deadline! This section highlights deliverables and
            tasks due soon. Click on any item to view details.
          </p>
        </div>
      ),
      position: "top",
      padding: 8,
    },
    {
      id: "pinned-items",
      selector: "[data-tour='pinned-items']",
      title: "Pinned Items",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Pin important programs or clients for quick access.
            Use the pin icon in any list to add items here.
          </p>
        </div>
      ),
      position: "right",
      padding: 8,
    },
    {
      id: "quick-actions",
      selector: "[data-tour='quick-actions']",
      title: "Quick Actions",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Access frequently used actions like creating new programs,
            adding clients, or generating reports from this menu.
          </p>
        </div>
      ),
      position: "left",
      padding: 8,
    },
  ],
};

// Auto-register this tour
registerTour(dashboardTour);

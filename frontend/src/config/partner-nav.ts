import {
  Home,
  Calendar,
  ClipboardList,
  ClipboardCheck,
  PackageCheck,
  MessageSquare,
  FileText,
  BarChart2,
  Settings,
  Bell,
  Award,
  Library,
  Wallet,
  RefreshCw,
  Webhook,
} from "lucide-react";
import type { PortalNavConfig } from "@/types/navigation";

export const partnerNavConfig: PortalNavConfig = {
  brandTitle: "AMG Partner Portal",
  collapsible: "offcanvas",
  groups: [
    {
      label: "Navigation",
      items: [
        {
          title: "Home",
          href: "/partner",
          icon: Home,
          tooltip: "Home",
        },
        {
          title: "Onboarding",
          href: "/partner/onboarding",
          icon: ClipboardCheck,
          tooltip: "Partner Onboarding",
          // Filtered out in (partner)/layout.tsx when onboarding.current_stage === "completed".
        },
        {
          title: "Assignments",
          href: "/partner/assignments",
          icon: ClipboardList,
          tooltip: "My Assignments",
        },
        {
          title: "Inbox",
          href: "/partner/inbox",
          icon: ClipboardList,
          tooltip: "Assignment Inbox",
        },
        {
          title: "Calendar",
          href: "/partner/calendar",
          icon: Calendar,
          tooltip: "Assignment Calendar",
        },
        {
          title: "Deliverables",
          href: "/partner/deliverables",
          icon: PackageCheck,
          tooltip: "Deliverables",
        },
        {
          title: "Templates",
          href: "/partner/templates",
          icon: Library,
          tooltip: "Template Library",
        },
        {
          title: "Messages",
          href: "/partner/messages",
          icon: MessageSquare,
          tooltip: "Messages with Coordinators",
        },
        {
          title: "Documents",
          href: "/partner/documents",
          icon: FileText,
          tooltip: "Brief Documents",
        },
        {
          title: "Notices",
          href: "/partner/notices",
          icon: Bell,
          tooltip: "Performance Notices",
        },
        {
          title: "Scorecard",
          href: "/partner/scorecard",
          icon: Award,
          tooltip: "Performance Scorecard",
        },
        {
          title: "Capability Refresh",
          href: "/partner/capability-refresh",
          icon: RefreshCw,
          tooltip: "Update Your Capabilities",
        },
        {
          title: "Payments",
          href: "/partner/payments",
          icon: Wallet,
          tooltip: "Payment History",
        },
        {
          title: "Reports",
          href: "/partner/reports",
          icon: BarChart2,
          tooltip: "Partner Reports",
          subItems: [
            {
              title: "Active Brief Summary",
              href: "/partner/reports/brief-summary",
            },
            {
              title: "Deliverable Feedback",
              href: "/partner/reports/feedback",
            },
            {
              title: "Engagement History",
              href: "/partner/reports/history",
            },
          ],
        },
        {
          title: "Settings",
          href: "/partner/settings",
          icon: Settings,
          tooltip: "Account Settings",
          subItems: [
            {
              title: "Profile",
              href: "/partner/settings/profile",
            },
            {
              title: "Notifications",
              href: "/partner/settings/notifications",
            },
            {
              title: "Security",
              href: "/partner/settings/security",
            },
            {
              title: "Webhooks",
              href: "/partner/settings/webhooks",
            },
          ],
        },
      ],
    },
  ],
};

import { Home, FileText, Settings, MessageSquare, LayoutList, Scale, FolderOpen, BarChart2, CalendarDays, CalendarClock, Sparkles } from "lucide-react";
import type { PortalNavConfig } from "@/types/navigation";

export const portalNavConfig: PortalNavConfig = {
  brandTitle: "AMG Portal",
  collapsible: "offcanvas",
  groups: [
    {
      label: "Navigation",
      items: [
        {
          title: "Dashboard",
          href: "/portal/dashboard",
          icon: Home,
          tooltip: "Dashboard",
        },
        {
          title: "Programs",
          href: "/portal/programs",
          icon: LayoutList,
          tooltip: "Programs",
        },
        {
          title: "Calendar",
          href: "/portal/calendar",
          icon: CalendarDays,
          tooltip: "Milestone Calendar",
        },
        {
          title: "Schedule Meeting",
          href: "/portal/schedule",
          icon: CalendarClock,
          tooltip: "Book a Meeting",
        },
        {
          title: "Messages",
          href: "/portal/messages",
          icon: MessageSquare,
          tooltip: "Messages",
        },
        {
          title: "Documents",
          href: "/portal/documents",
          icon: FolderOpen,
          tooltip: "Documents",
        },
        {
          title: "Decisions",
          href: "/portal/decisions",
          icon: Scale,
          tooltip: "Decisions",
        },
        {
          title: "What's New",
          href: "/portal/updates",
          icon: Sparkles,
          tooltip: "What's New",
        },
        {
          title: "Survey",
          href: "/portal/survey",
          icon: BarChart2,
          tooltip: "Satisfaction Survey",
        },
        {
          title: "Reports",
          href: "/portal/reports",
          icon: FileText,
          tooltip: "Reports",
          subItems: [
            { title: "Portfolio", href: "/portal/reports/portfolio" },
            { title: "Program Status", href: "/portal/reports/program-status" },
            { title: "Completion", href: "/portal/reports/completion" },
            { title: "Annual Review", href: "/portal/reports/annual" },
          ],
        },
        {
          title: "Settings",
          href: "/portal/settings",
          icon: Settings,
          tooltip: "Settings",
          subItems: [
            { title: "Profile", href: "/portal/settings/profile" },
            { title: "Notifications", href: "/portal/settings/notifications" },
            { title: "Security", href: "/portal/settings/security" },
          ],
        },
      ],
    },
  ],
};

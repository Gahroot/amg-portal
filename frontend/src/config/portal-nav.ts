import { Home, FileText, FileSignature, Settings, MessageSquare, ClipboardCheck, Briefcase, GitPullRequestArrow, Heart } from "lucide-react";
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
          icon: Briefcase,
          tooltip: "Your Programs",
        },
        {
          title: "Decisions",
          href: "/portal/decisions",
          icon: GitPullRequestArrow,
          tooltip: "Decision Requests",
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
          icon: FileSignature,
          tooltip: "Documents & Signing",
        },
        {
          title: "Preferences",
          href: "/portal/preferences",
          icon: Heart,
          tooltip: "My Preferences",
        },
        {
          title: "Surveys",
          href: "/portal/surveys",
          icon: ClipboardCheck,
          tooltip: "Surveys",
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

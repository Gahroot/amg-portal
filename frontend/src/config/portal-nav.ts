import { Home, FileText, Settings, MessageSquare } from "lucide-react";
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
          title: "Messages",
          href: "/portal/messages",
          icon: MessageSquare,
          tooltip: "Messages",
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
        },
      ],
    },
  ],
};

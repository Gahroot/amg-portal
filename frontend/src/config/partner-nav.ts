import { Home, ClipboardList, PackageCheck, MessageSquare, Settings } from "lucide-react";
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
          title: "Messages",
          href: "/partner/messages",
          icon: MessageSquare,
          tooltip: "Messages",
        },
        {
          title: "Assignments",
          href: "/partner/assignments",
          icon: ClipboardList,
          tooltip: "Assignments",
        },
        {
          title: "Deliverables",
          href: "/partner/deliverables",
          icon: PackageCheck,
          tooltip: "Deliverables",
        },
        {
          title: "Settings",
          href: "/partner/settings",
          icon: Settings,
          tooltip: "Settings",
          subItems: [
            { title: "Profile", href: "/partner/settings/profile" },
            { title: "Notifications", href: "/partner/settings/notifications" },
            { title: "Security", href: "/partner/settings/security" },
          ],
        },
      ],
    },
  ],
};

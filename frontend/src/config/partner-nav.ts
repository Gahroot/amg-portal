import { Home, ClipboardList, PackageCheck, MessageSquare, FileText } from "lucide-react";
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
          title: "Inbox",
          href: "/partner/inbox",
          icon: ClipboardList,
          tooltip: "Assignment Inbox",
        },
        {
          title: "Deliverables",
          href: "/partner/deliverables",
          icon: PackageCheck,
          tooltip: "Deliverables",
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
      ],
    },
  ],
};

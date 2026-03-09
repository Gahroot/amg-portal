import { Home, ClipboardList, PackageCheck } from "lucide-react";
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
      ],
    },
  ],
};

import {
  LayoutDashboard,
  Users,
  Handshake,
  UserCog,
  FolderKanban,
  PackageCheck,
  ClipboardList,
  CheckSquare,
  ShieldCheck,
  Timer,
  AlertTriangle,
  ScrollText,
  Scale,
  BarChart3,
  Star,
  CalendarClock,
  MessageSquare,
  Bell,
  Settings,
  Briefcase,
  Kanban,
} from "lucide-react";
import type { PortalNavConfig } from "@/types/navigation";

const MD = "managing_director";
const RM = "relationship_manager";
const COORD = "coordinator";
const FIN = "finance_compliance";

export const dashboardNavConfig: PortalNavConfig = {
  brandTitle: "AMG Portal",
  collapsible: "icon",
  groups: [
    {
      label: "Main",
      items: [
        {
          title: "Dashboard",
          href: "/",
          icon: LayoutDashboard,
          tooltip: "Dashboard",
        },
      ],
    },
    {
      label: "People",
      items: [
        {
          title: "Clients",
          href: "/clients",
          icon: Users,
          tooltip: "Clients",
          roles: [MD, RM, COORD],
        },
        {
          title: "Partners",
          href: "/partners",
          icon: Handshake,
          tooltip: "Partners",
          roles: [MD, RM, COORD],
        },
        {
          title: "Workload",
          href: "/workload",
          icon: Briefcase,
          tooltip: "Staff Workload",
          roles: [MD, RM, COORD],
        },
        {
          title: "Users",
          href: "/users",
          icon: UserCog,
          tooltip: "Users",
          roles: [MD],
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          title: "Programs",
          href: "/programs",
          icon: FolderKanban,
          tooltip: "Programs",
        },
        {
          title: "Task Board",
          href: "/tasks",
          icon: Kanban,
          tooltip: "Task Board",
          roles: [MD, RM, COORD],
        },
        {
          title: "Deliverables",
          href: "/deliverables",
          icon: PackageCheck,
          tooltip: "Deliverables",
          roles: [MD, RM, COORD],
        },
        {
          title: "Assignments",
          href: "/assignments",
          icon: ClipboardList,
          tooltip: "Assignments",
          roles: [MD, RM, COORD],
        },
      ],
    },
    {
      label: "Oversight",
      items: [
        {
          title: "Approvals",
          href: "/approvals",
          icon: CheckSquare,
          tooltip: "Approvals",
          roles: [MD, FIN],
        },
        {
          title: "Compliance",
          href: "/compliance",
          icon: ShieldCheck,
          tooltip: "Compliance",
          roles: [MD, FIN],
        },
        {
          title: "SLA Tracking",
          href: "/sla",
          icon: Timer,
          tooltip: "SLA Tracking",
          roles: [MD, RM, COORD],
        },
        {
          title: "Escalations",
          href: "/escalations",
          icon: AlertTriangle,
          tooltip: "Escalations",
        },
        {
          title: "Audit Logs",
          href: "/audit-logs",
          icon: ScrollText,
          tooltip: "Audit Logs",
          roles: [MD, FIN],
        },
        {
          title: "Decisions",
          href: "/decisions",
          icon: Scale,
          tooltip: "Decisions",
          roles: [MD, RM],
        },
      ],
    },
    {
      label: "Insights",
      items: [
        {
          title: "Analytics",
          href: "/analytics",
          icon: BarChart3,
          tooltip: "Analytics",
          roles: [MD, RM],
        },
        {
          title: "Partner Performance",
          href: "/partner-performance",
          icon: Star,
          tooltip: "Partner Performance",
          roles: [MD, RM],
        },
        {
          title: "Report Schedules",
          href: "/report-schedules",
          icon: CalendarClock,
          tooltip: "Report Schedules",
          roles: [MD, RM],
        },
      ],
    },
    {
      label: "Communication",
      items: [
        {
          title: "Messages",
          href: "/communications",
          icon: MessageSquare,
          tooltip: "Messages",
        },
        {
          title: "Notifications",
          href: "/notifications",
          icon: Bell,
          tooltip: "Notifications",
        },
      ],
    },
    {
      label: "Settings",
      items: [
        {
          title: "Settings",
          href: "/settings",
          icon: Settings,
          tooltip: "Settings",
        },
      ],
    },
  ],
};

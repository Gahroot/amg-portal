import type { LucideIcon } from "lucide-react";

export interface NavSubItem {
  title: string;
  href: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  tooltip?: string;
  roles?: string[];
  subItems?: NavSubItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface PortalNavConfig {
  brandTitle: string;
  collapsible: "offcanvas" | "icon" | "none";
  groups: NavGroup[];
}

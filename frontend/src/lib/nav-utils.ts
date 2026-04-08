import type { LucideIcon } from "lucide-react";
import type { PortalNavConfig } from "@/types/navigation";
import type { UserRole } from "@/types/user";
import { dashboardNavConfig } from "@/config/dashboard-nav";
import { portalNavConfig } from "@/config/portal-nav";
import { partnerNavConfig } from "@/config/partner-nav";

export interface FlatNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  group: string;
  tooltip?: string;
  searchValue: string;
  isSubItem: boolean;
}

/**
 * Returns the appropriate nav config for a given user role.
 */
export function getNavConfigForRole(role: UserRole): PortalNavConfig {
  if (role === "client") return portalNavConfig;
  if (role === "partner") return partnerNavConfig;
  return dashboardNavConfig;
}

/**
 * Flattens a PortalNavConfig into a flat array of nav items,
 * applying role-based filtering.
 */
export function getFlatNavItems(
  config: PortalNavConfig,
  role: UserRole,
): FlatNavItem[] {
  const items: FlatNavItem[] = [];

  for (const group of config.groups) {
    for (const item of group.items) {
      if (item.roles && !item.roles.includes(role)) continue;

      items.push({
        title: item.title,
        href: item.href,
        icon: item.icon,
        group: group.label,
        tooltip: item.tooltip,
        searchValue: [group.label, item.title, item.tooltip]
          .filter(Boolean)
          .join(" "),
        isSubItem: false,
      });

      if (item.subItems) {
        for (const sub of item.subItems) {
          const title = `${item.title} > ${sub.title}`;
          items.push({
            title,
            href: sub.href,
            icon: item.icon,
            group: group.label,
            tooltip: item.tooltip,
            searchValue: [group.label, title, item.tooltip]
              .filter(Boolean)
              .join(" "),
            isSubItem: true,
          });
        }
      }
    }
  }

  return items;
}

/**
 * Same as getFlatNavItems but returns items grouped by group label.
 */
export function getGroupedNavItems(
  config: PortalNavConfig,
  role: UserRole,
): Record<string, FlatNavItem[]> {
  const flat = getFlatNavItems(config, role);
  const grouped: Record<string, FlatNavItem[]> = {};

  for (const item of flat) {
    if (!grouped[item.group]) {
      grouped[item.group] = [];
    }
    grouped[item.group].push(item);
  }

  return grouped;
}

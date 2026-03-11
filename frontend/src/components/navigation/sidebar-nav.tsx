"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Collapsible } from "radix-ui";
import { useAuth } from "@/providers/auth-provider";
import { useUnreadMessageCount } from "@/hooks/use-conversations";
import type { PortalNavConfig, NavItem } from "@/types/navigation";
import { Badge } from "@/components/ui/badge";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";

function isActive(pathname: string, href: string): boolean {
  if (href === "/" || href === "/partner") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

function isMessagesItem(item: NavItem): boolean {
  return item.title === "Messages" || item.href.includes("/messages");
}

function NavItemWithSub({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const subActive = item.subItems?.some((sub) => isActive(pathname, sub.href)) ?? false;

  return (
    <Collapsible.Root defaultOpen={active || subActive} className="group/collapsible">
      <SidebarMenuItem>
        <Collapsible.Trigger asChild>
          <SidebarMenuButton tooltip={item.tooltip} isActive={active || subActive}>
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <SidebarMenuSub>
            {item.subItems!.map((sub) => (
              <SidebarMenuSubItem key={sub.href}>
                <SidebarMenuSubButton asChild isActive={isActive(pathname, sub.href)}>
                  <Link href={sub.href}>
                    <span>{sub.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </Collapsible.Content>
      </SidebarMenuItem>
    </Collapsible.Root>
  );
}

function NavItemLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const unreadCount = useUnreadMessageCount();
  const showBadge = isMessagesItem(item) && unreadCount > 0;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.tooltip} isActive={isActive(pathname, item.href)}>
        <Link href={item.href} className="relative flex items-center gap-2">
          <item.icon />
          <span>{item.title}</span>
          {showBadge && (
            <Badge
              variant="destructive"
              className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface SidebarNavProps {
  config: PortalNavConfig;
}

export function SidebarNav({ config }: SidebarNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = user?.role;

  return (
    <SidebarContent>
      {config.groups.map((group) => {
        const visibleItems = group.items.filter(
          (item) => !item.roles || (userRole && item.roles.includes(userRole))
        );

        if (visibleItems.length === 0) return null;

        return (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {visibleItems.map((item) =>
                item.subItems && item.subItems.length > 0 ? (
                  <NavItemWithSub key={item.href} item={item} pathname={pathname} />
                ) : (
                  <NavItemLink key={item.href} item={item} pathname={pathname} />
                )
              )}
            </SidebarMenu>
          </SidebarGroup>
        );
      })}
    </SidebarContent>
  );
}

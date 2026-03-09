"use client";

import type { PortalNavConfig } from "@/types/navigation";
import { Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { SidebarBrandHeader } from "./sidebar-brand-header";
import { SidebarNav } from "./sidebar-nav";
import { SidebarUserFooter } from "./sidebar-user-footer";

interface AppSidebarProps {
  config: PortalNavConfig;
}

export function AppSidebar({ config }: AppSidebarProps) {
  return (
    <Sidebar collapsible={config.collapsible}>
      <SidebarBrandHeader title={config.brandTitle} />
      <SidebarNav config={config} />
      <SidebarUserFooter />
      <SidebarRail />
    </Sidebar>
  );
}

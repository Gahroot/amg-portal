"use client";

import type { PortalNavConfig } from "@/types/navigation";
import { Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { SidebarBrandHeader } from "./sidebar-brand-header";
import { SidebarNav } from "./sidebar-nav";
import { SidebarUserFooter } from "./sidebar-user-footer";
import { AlertsPanel } from "@/components/escalations/alerts-panel";
import { PinnedItems } from "@/components/navigation/pinned-items";
import { RecentItems } from "@/components/navigation/recent-items";

interface AppSidebarProps {
  config: PortalNavConfig;
  showAlerts?: boolean;
}

export function AppSidebar({ config, showAlerts = false }: AppSidebarProps) {
  return (
    <Sidebar collapsible={config.collapsible}>
      <SidebarBrandHeader title={config.brandTitle} />
      <SidebarNav config={config} />
      {showAlerts && <AlertsPanel />}
      <PinnedItems />
      <RecentItems limit={5} />
      <SidebarUserFooter />
      <SidebarRail />
    </Sidebar>
  );
}

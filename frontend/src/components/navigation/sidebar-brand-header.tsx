"use client";

import Image from "next/image";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

interface SidebarBrandHeaderProps {
  title: string;
}

export function SidebarBrandHeader({ title }: SidebarBrandHeaderProps) {
  const { state } = useSidebar();

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
            <Image
              src="/logo.webp"
              alt="Anchor Mill Group"
              width={32}
              height={32}
              className="shrink-0"
              priority
            />
            {state === "expanded" && (
              <span className="font-serif text-lg font-bold tracking-tight truncate">
                {title}
              </span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

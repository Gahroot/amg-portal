"use client";

import Link from "next/link";
import { FolderOpen, Handshake, Loader2, Pin, Star, Users } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBookmarks, useToggleBookmark } from "@/hooks/use-bookmarks";
import type { Bookmark, BookmarkEntityType } from "@/lib/api/bookmarks";
import { Button } from "@/components/ui/button";

const entityIcons: Record<
  BookmarkEntityType,
  React.ComponentType<{ className?: string }>
> = {
  program: FolderOpen,
  client: Users,
  partner: Handshake,
};

const entityUrls: Record<BookmarkEntityType, string> = {
  program: "/programs",
  client: "/clients",
  partner: "/partners",
};

function PinnedItem({ bookmark }: { bookmark: Bookmark }) {
  const { toggle, isPending } = useToggleBookmark();
  const Icon = entityIcons[bookmark.entity_type];
  const url = `${entityUrls[bookmark.entity_type]}/${bookmark.entity_id}`;

  return (
    <SidebarMenuItem>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild className="group pr-1">
              <Link href={url} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1 text-sm">
                  {bookmark.entity_title}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500"
                  disabled={isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(true, {
                      entity_type: bookmark.entity_type,
                      entity_id: bookmark.entity_id,
                      entity_title: bookmark.entity_title,
                      entity_subtitle: bookmark.entity_subtitle,
                    });
                  }}
                  aria-label="Unpin"
                >
                  <Star className="h-3 w-3 fill-current" />
                </Button>
              </Link>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{bookmark.entity_title}</p>
              {bookmark.entity_subtitle && (
                <p className="text-xs text-muted-foreground">
                  {bookmark.entity_subtitle}
                </p>
              )}
              <p className="text-xs text-muted-foreground capitalize">
                {bookmark.entity_type}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </SidebarMenuItem>
  );
}

export function PinnedItems() {
  const { data, isLoading, error } = useBookmarks();

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center gap-2">
          <Pin className="h-3.5 w-3.5" />
          Pinned
        </SidebarGroupLabel>
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </SidebarGroup>
    );
  }

  if (error || !data?.items?.length) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2">
        <Pin className="h-3.5 w-3.5" />
        Pinned
      </SidebarGroupLabel>
      <SidebarMenu>
        {data.items.map((bookmark) => (
          <PinnedItem key={bookmark.id} bookmark={bookmark} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

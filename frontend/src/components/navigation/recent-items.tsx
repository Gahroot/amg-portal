"use client";

import Link from "next/link";
import { useRecentItems, useDeleteRecentItem } from "@/hooks/use-recent-items";
import {
  FolderOpen,
  Users,
  Handshake,
  FileText,
  Clock,
  X,
  Loader2,
  CheckSquare,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RecentItemType } from "@/lib/api/recent-items";

const itemIcons: Record<RecentItemType, React.ComponentType<{ className?: string }>> = {
  program: FolderOpen,
  client: Users,
  partner: Handshake,
  document: FileText,
  task: CheckSquare,
};

const typeLabels: Record<RecentItemType, string> = {
  program: "Program",
  client: "Client",
  partner: "Partner",
  document: "Document",
  task: "Task",
};

interface RecentItemsProps {
  limit?: number;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function RecentItems({ limit = 5 }: RecentItemsProps) {
  const { data, isLoading, error } = useRecentItems(limit);
  const deleteMutation = useDeleteRecentItem();

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Recent
        </SidebarGroupLabel>
        <div className="flex items-center justify-center py-4">
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
        <Clock className="h-3.5 w-3.5" />
        Recent
      </SidebarGroupLabel>
      <SidebarMenu>
        {data.items.map((item) => {
          const Icon = itemIcons[item.item_type];
          const timeLabel = formatRelativeTime(item.viewed_at);

          return (
            <SidebarMenuItem key={item.id}>
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      className="group pr-1"
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate flex-1 text-sm">
                          {item.item_title}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 mr-1">
                          {timeLabel}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteMutation.mutate(item.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </Link>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium">{item.item_title}</p>
                      {item.item_subtitle && (
                        <p className="text-xs text-muted-foreground">
                          {item.item_subtitle}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {typeLabels[item.item_type]} • {timeLabel}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

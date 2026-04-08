"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import type { NotificationGroup, Notification } from "@/types/communication";
import { NotificationItem } from "./notification-item";

interface NotificationGroupProps {
  group: NotificationGroup;
  groupMode: "type" | "entity" | "time";
  onRead: (id: string) => void;
  onMarkGroupRead?: (groupKey: string, groupMode: "type" | "entity" | "time") => void;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:text-red-300 dark:bg-red-900/30",
  high: "bg-orange-100 text-orange-700 dark:text-orange-300 dark:bg-orange-900/30",
  normal: "bg-blue-100 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30",
  low: "bg-muted text-foreground/80",
};

export function NotificationGroup({
  group,
  groupMode,
  onRead,
  onMarkGroupRead,
}: NotificationGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMultiple = group.notifications.length > 1;

  const handleMarkGroupRead = () => {
    if (onMarkGroupRead) {
      onMarkGroupRead(group.group_key, groupMode);
    }
  };

  // Single notification - show as regular item
  if (!hasMultiple) {
    const notification = group.notifications[0];
    if (!notification) return null;
    return (
      <NotificationItem
        notification={notification}
        onRead={onRead}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        !group.is_read && "bg-muted/30"
      )}
    >
      {/* Group Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Expand/Collapse indicator */}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}

          {/* Group label */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm font-medium">
              {group.group_label}
            </span>
            <span className="text-xs text-muted-foreground">
              {group.latest_title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Unread count badge */}
          {group.unread_count > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {group.unread_count} unread
            </Badge>
          )}
          {/* Total count */}
          <Badge variant="outline" className="shrink-0">
            {group.count}
          </Badge>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-3 py-2">
          {/* Mark all as read button */}
          {group.unread_count > 0 && onMarkGroupRead && (
            <div className="mb-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkGroupRead();
                }}
              >
                <Check className="mr-1 h-3 w-3" />
                Mark all as read
              </Button>
            </div>
          )}

          {/* Individual notifications */}
          <div className="space-y-2">
            {group.notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={onRead}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

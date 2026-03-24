"use client";

import { format } from "date-fns";
import type { Notification, SnoozeDurationPreset } from "@/types/communication";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  AlertCircle,
  CheckCircle,
  FileText,
  Users,
  Settings,
  Bell,
} from "lucide-react";
import { SnoozeButton } from "./snooze-button";

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
  onSnooze?: (id: string, durationMinutes: SnoozeDurationPreset) => void;
  onUnsnooze?: (id: string) => void;
  compact?: boolean;
}

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  communication: MessageSquare,
  decision_pending: AlertCircle,
  assignment_update: Users,
  deliverable_ready: FileText,
  milestone_update: CheckCircle,
  approval_required: AlertCircle,
  system: Settings,
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function NotificationItem({
  notification,
  onRead,
  onSnooze,
  onUnsnooze,
  compact = false
}: NotificationItemProps) {
  const Icon = icons[notification.notification_type] || Bell;
  const createdDate = new Date(notification.created_at);
  const isSnoozed = !!notification.snoozed_until && new Date(notification.snoozed_until) > new Date();

  const handleRead = () => {
    if (onRead) {
      onRead(notification.id);
    }
  };

  const handleSnooze = (durationMinutes: SnoozeDurationPreset) => {
    if (onSnooze) {
      onSnooze(notification.id, durationMinutes);
    }
  };

  const handleUnsnooze = () => {
    if (onUnsnooze) {
      onUnsnooze(notification.id);
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-muted/50",
          !notification.is_read && "bg-muted/20",
          isSnoozed && "bg-amber-50/50 dark:bg-amber-950/20"
        )}
      >
        {/* Icon */}
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          priorityColors[notification.priority] || priorityColors.normal
        )}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className={cn(
              "text-sm",
              notification.is_read ? "text-muted-foreground" : "font-medium"
            )}>
              {notification.title}
            </span>
            <div className="flex items-center gap-1">
              {isSnoozed ? (
                <SnoozeButton
                  isSnoozed={isSnoozed}
                  snoozedUntil={notification.snoozed_until}
                  snoozeCount={notification.snooze_count}
                  onUnsnooze={handleUnsnooze}
                  compact
                />
              ) : (
                onSnooze && (
                  <SnoozeButton
                    onSnooze={handleSnooze}
                    snoozeCount={notification.snooze_count}
                    compact
                  />
                )
              )}
              {!notification.is_read && onRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-xs"
                  onClick={handleRead}
                >
                  Read
                </Button>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {format(createdDate, "MMM d, h:mm a")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
        !notification.is_read && "bg-muted/30",
        isSnoozed && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          priorityColors[notification.priority] || priorityColors.normal
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold">{notification.title}</h4>
          <div className="flex items-center gap-1">
            {!notification.is_read && onRead && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleRead}
              >
                Mark read
              </Button>
            )}
            {isSnoozed ? (
              <SnoozeButton
                isSnoozed={isSnoozed}
                snoozedUntil={notification.snoozed_until}
                snoozeCount={notification.snooze_count}
                onUnsnooze={handleUnsnooze}
              />
            ) : (
              onSnooze && (
                <SnoozeButton
                  onSnooze={handleSnooze}
                  snoozeCount={notification.snooze_count}
                />
              )
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.body}
        </p>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {notification.notification_type.replace(/_/g, " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(createdDate, "MMM d, h:mm a")}
          </span>
        </div>
        {notification.action_url && (
          <Button
            variant="link"
            className="h-auto p-0 text-sm"
            asChild
          >
            <a href={notification.action_url}>
              {notification.action_label || "View"}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

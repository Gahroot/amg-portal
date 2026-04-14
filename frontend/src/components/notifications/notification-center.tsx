"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useNotifications,
  useGroupedNotifications,
  useMarkNotificationRead,
  useMarkGroupRead,
  useMarkAllNotificationsRead,
  useSnoozedNotifications,
  useSnoozeNotification,
  useUnsnoozeNotification,
} from "@/hooks/use-notifications";
import { NotificationItem } from "./notification-item";
import { NotificationGroup } from "./notification-group";
import { CheckCheck, Layers, List, AlarmClock } from "lucide-react";
import type { NotificationGroup as NotificationGroupType, NotificationListResponse } from "@/types/notification";
import type { SnoozeDurationPreset } from "@/types/communication";

interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GroupMode = "type" | "entity" | "time";

export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [groupMode, setGroupMode] = useState<GroupMode>("type");

  const { data: allNotifications } = useNotifications();
  const { data: unreadNotifications } = useNotifications({ unread_only: true });
  const { data: groupedNotifications } = useGroupedNotifications({
    unread_only: true,
    group_mode: groupMode,
  });
  const { data: snoozedNotifications } = useSnoozedNotifications();

  const markRead = useMarkNotificationRead();
  const markGroupRead = useMarkGroupRead();
  const markAllRead = useMarkAllNotificationsRead();
  const snoozeNotification = useSnoozeNotification();
  const unsnoozeNotification = useUnsnoozeNotification();

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const handleMarkGroupRead = (groupKey: string, mode: GroupMode) => {
    markGroupRead.mutate({ groupKey, groupMode: mode });
  };

  const handleSnooze = (id: string, durationMinutes: SnoozeDurationPreset) => {
    snoozeNotification.mutate({ id, durationMinutes });
  };

  const handleUnsnooze = (id: string) => {
    unsnoozeNotification.mutate(id);
  };

  const renderGroupedView = (groups: NotificationGroupType[] | undefined) => {
    if (!groups || groups.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No notifications
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {groups.map((group) => (
          <NotificationGroup
            key={group.group_key}
            group={group}
            groupMode={groupMode}
            onRead={(id) => markRead.mutate(id)}
            onMarkGroupRead={handleMarkGroupRead}
          />
        ))}
      </div>
    );
  };

  const renderListView = (notifications: NotificationListResponse | undefined, emptyMessage: string) => {
    if (!notifications || notifications.notifications.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {notifications.notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRead={(id) => markRead.mutate(id)}
            onSnooze={handleSnooze}
            onUnsnooze={handleUnsnooze}
          />
        ))}
      </div>
    );
  };

  const renderSnoozedView = () => {
    if (!snoozedNotifications || snoozedNotifications.notifications.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No snoozed notifications
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {snoozedNotifications.notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRead={(id) => markRead.mutate(id)}
            onSnooze={handleSnooze}
            onUnsnooze={handleUnsnooze}
          />
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="unread" className="flex-1">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="unread">
                Unread {unreadNotifications && unreadNotifications.total > 0 && `(${unreadNotifications.total})`}
              </TabsTrigger>
              <TabsTrigger value="snoozed">
                <AlarmClock className="mr-1 h-3 w-3" />
                Snoozed {snoozedNotifications && snoozedNotifications.total > 0 && `(${snoozedNotifications.total})`}
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
            {unreadNotifications && unreadNotifications.total > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="mr-1 h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>

          {/* View mode controls */}
          <div className="flex items-center justify-between border-b py-2">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="mr-1 h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === "grouped" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grouped")}
              >
                <Layers className="mr-1 h-4 w-4" />
                Grouped
              </Button>
            </div>

            {viewMode === "grouped" && (
              <Select value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="type">By Type</SelectItem>
                  <SelectItem value="entity">By Entity</SelectItem>
                  <SelectItem value="time">By Time</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <TabsContent value="unread" className="mt-4">
            <ScrollArea className="h-[400px]">
              {viewMode === "grouped"
                ? renderGroupedView(groupedNotifications?.groups)
                : renderListView(unreadNotifications, "No unread notifications")}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="snoozed" className="mt-4">
            <ScrollArea className="h-[400px]">
              {renderSnoozedView()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <ScrollArea className="h-[400px]">
              {renderListView(allNotifications, "No notifications")}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

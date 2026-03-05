"use client";

import { useState } from "react";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationItem } from "@/components/notifications/notification-item";
import { CheckCheck } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const { data: allNotifications } = useNotifications();
  const { data: unreadNotifications } = useNotifications({ unread_only: true });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const displayedNotifications = filter === "unread" ? unreadNotifications : allNotifications;

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <div className="container max-w-3xl py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your activities and alerts
          </p>
        </div>
        <div className="md:hidden">
          <NotificationBell />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="unread">
              Unread {unreadNotifications && unreadNotifications.total > 0 && `(${unreadNotifications.total})`}
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          {unreadNotifications && unreadNotifications.total > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        <TabsContent value={filter} className="mt-6">
          <ScrollArea className="h-[calc(100vh-20rem)]">
            {displayedNotifications && displayedNotifications.notifications.length > 0 ? (
              <div className="space-y-3">
                {displayedNotifications.notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markRead.mutate(notification.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground">
                    {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

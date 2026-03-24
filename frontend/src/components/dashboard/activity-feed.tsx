"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  FileText,
  Mail,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityFeedItem } from "@/lib/api/dashboard";

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  communication: <Mail className="h-4 w-4 text-blue-500" />,
  escalation: <AlertTriangle className="h-4 w-4 text-red-500" />,
  deliverable_submission: <FileText className="h-4 w-4 text-green-500" />,
  status_change: <MessageSquare className="h-4 w-4 text-amber-500" />,
};

interface ActivityFeedProps {
  items: ActivityFeedItem[] | undefined;
  isLoading: boolean;
}

function ActivityItem({ item }: { item: ActivityFeedItem }) {
  const icon = ACTIVITY_ICONS[item.activity_type] ?? (
    <MessageSquare className="h-4 w-4 text-muted-foreground" />
  );

  const timeAgo = formatDistanceToNow(new Date(item.timestamp), {
    addSuffix: true,
  });

  const content = (
    <div className="flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-muted/50">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.description}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.actor_name && (
            <span className="font-medium">{item.actor_name} · </span>
          )}
          {timeAgo}
        </p>
      </div>
    </div>
  );

  if (item.link) {
    return <Link href={item.link}>{content}</Link>;
  }
  return content;
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Activity Feed
        </CardTitle>
        <CardDescription>
          Recent activity across programs, escalations, and deliverables
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {items.map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recent activity.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

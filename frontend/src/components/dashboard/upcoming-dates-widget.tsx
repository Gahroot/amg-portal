"use client";

import Link from "next/link";
import { CalendarDays, MessageSquare } from "lucide-react";
import { useUpcomingDates } from "@/hooks/use-clients";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function DaysBadge({ daysUntil }: { daysUntil: number }) {
  if (daysUntil === 0) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 dark:bg-amber-900/30">
        Today
      </Badge>
    );
  }
  if (daysUntil === 1) {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 dark:bg-blue-900/30">
        Tomorrow
      </Badge>
    );
  }
  if (daysUntil <= 7) {
    return (
      <Badge variant="outline">
        {daysUntil} days
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {daysUntil} days
    </Badge>
  );
}

export function UpcomingDatesWidget() {
  const { data: items, isLoading } = useUpcomingDates(14);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">
            Upcoming Client Dates
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No upcoming dates in the next 14 days
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={`${item.client_id}-${item.date_type}-${index}`}
                className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    <Link
                      href={`/clients/${item.client_id}`}
                      className="hover:underline"
                    >
                      {item.client_name}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.date_type === "birthday" ? "🎂 Birthday" : `📅 ${item.label}`}
                    {item.years_since != null && (
                      <span className="ml-1">· {item.years_since} yr{item.years_since !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <DaysBadge daysUntil={item.days_until} />
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    title="Send message"
                  >
                    <Link href={`/clients/${item.client_id}?tab=preferences`}>
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { format } from "date-fns";
import {
  Calendar,
  Clock,
  MapPin,
  Link as LinkIcon,
  Users,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConfirmEvent, useCancelEvent } from "@/hooks/use-scheduling";
import type { ScheduledEvent } from "@/types/scheduling";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-gray-100 text-gray-800",
};

const typeLabels: Record<string, string> = {
  meeting: "Meeting",
  call: "Call",
  site_visit: "Site Visit",
  review: "Review",
  deadline: "Deadline",
};

interface EventDetailProps {
  event: ScheduledEvent;
}

export function EventDetail({ event }: EventDetailProps) {
  const confirmMutation = useConfirmEvent();
  const cancelMutation = useCancelEvent();

  const canConfirm = event.status === "scheduled";
  const canCancel = event.status !== "cancelled" && event.status !== "completed";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{event.title}</CardTitle>
            <CardDescription>{typeLabels[event.event_type] || event.event_type}</CardDescription>
          </div>
          <Badge className={statusColors[event.status] || ""}>
            {event.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{format(new Date(event.start_time), "PPP")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>
            {format(new Date(event.start_time), "p")} –{" "}
            {format(new Date(event.end_time), "p")} ({event.timezone})
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{event.location}</span>
          </div>
        )}
        {event.virtual_link && (
          <div className="flex items-center gap-2 text-sm">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <a
              href={event.virtual_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Join virtual meeting
            </a>
          </div>
        )}
        {event.attendee_ids && event.attendee_ids.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{event.attendee_ids.length} attendee(s)</span>
          </div>
        )}
        {event.description && (
          <div className="flex items-start gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground">{event.description}</p>
          </div>
        )}
        {event.notes && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Notes</p>
            <p>{event.notes}</p>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          {canConfirm && (
            <Button
              size="sm"
              onClick={() => confirmMutation.mutate(event.id)}
              disabled={confirmMutation.isPending}
            >
              Confirm
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => cancelMutation.mutate(event.id)}
              disabled={cancelMutation.isPending}
            >
              Cancel Event
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

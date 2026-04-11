"use client";

import { useState } from "react";
import { format, parseISO, startOfToday } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCancelMeeting, useRescheduleMeeting } from "@/hooks/use-meetings";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/types/meeting";
import { STATUS_CONFIG } from "./shared";

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const cardToday = startOfToday();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  const cancelMutation = useCancelMeeting();
  const rescheduleMutation = useRescheduleMeeting();

  const statusCfg = STATUS_CONFIG[meeting.status] ?? STATUS_CONFIG.pending;
  const mt = meeting.meeting_type;

  const handleCancel = async () => {
    await cancelMutation.mutateAsync({
      meetingId: meeting.id,
      data: { reason: cancelReason || undefined },
    });
    setCancelOpen(false);
  };

  const handleReschedule = async () => {
    if (!newDate || !newTime) return;
    const newStartTime = new Date(`${newDate}T${newTime}:00`).toISOString();
    await rescheduleMutation.mutateAsync({
      meetingId: meeting.id,
      data: {
        new_start_time: newStartTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    setRescheduleOpen(false);
  };

  const canCancel = !["cancelled", "completed"].includes(meeting.status);
  const canReschedule = !["cancelled", "completed"].includes(meeting.status);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{mt?.label ?? "Meeting"}</CardTitle>
            <CardDescription>
              {format(parseISO(meeting.start_time), "EEE, MMM d 'at' h:mm a")} –{" "}
              {format(parseISO(meeting.end_time), "h:mm a")}
            </CardDescription>
          </div>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full border flex-shrink-0",
              statusCfg.className
            )}
          >
            {statusCfg.label}
          </span>
        </div>
      </CardHeader>
      {meeting.agenda && (
        <CardContent className="pt-0 pb-2">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {meeting.agenda}
          </p>
        </CardContent>
      )}
      {(canCancel || canReschedule) && (
        <CardFooter className="gap-2 pt-2">
          {canReschedule && (
            <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Reschedule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Reschedule Meeting</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="space-y-1">
                    <Label>New date</Label>
                    <Input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      min={format(cardToday, "yyyy-MM-dd")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>New time</Label>
                    <Input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleReschedule}
                    disabled={
                      !newDate || !newTime || rescheduleMutation.isPending
                    }
                  >
                    {rescheduleMutation.isPending
                      ? "Rescheduling…"
                      : "Reschedule"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canCancel && (
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  Cancel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Cancel Meeting</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to cancel this meeting? Your RM will
                    be notified.
                  </p>
                  <Textarea
                    placeholder="Reason (optional)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelOpen(false)}
                    >
                      Keep meeting
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending
                        ? "Cancelling…"
                        : "Cancel meeting"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

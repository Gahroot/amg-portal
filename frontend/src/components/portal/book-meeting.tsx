"use client";

import { useState } from "react";
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfToday,
} from "date-fns";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAvailableSlots, useBookMeeting, useMeetingTypes } from "@/hooks/use-meetings";
import type { AvailableSlot, MeetingType } from "@/types/meeting";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function durationBadgeColor(minutes: number): string {
  if (minutes <= 15) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (minutes <= 30) return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-violet-100 text-violet-700 border-violet-200";
}

// ─── Step types ───────────────────────────────────────────────────────────────

type Step = "type" | "slot" | "agenda" | "confirm";

// ─── Main Component ───────────────────────────────────────────────────────────

interface BookMeetingProps {
  onBooked?: () => void;
}

export function BookMeeting({ onBooked }: BookMeetingProps) {
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<MeetingType | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [agenda, setAgenda] = useState("");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week
  const [booked, setBooked] = useState(false);

  const today = startOfToday();
  const weekStart = addDays(today, weekOffset * 7);
  const weekEnd = addDays(weekStart, 13); // show 2 weeks at a time

  const { data: meetingTypes, isLoading: typesLoading } = useMeetingTypes();

  const slotsEnabled = step === "slot" && !!selectedType;
  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    {
      meeting_type_id: selectedType?.id ?? "",
      from_date: format(weekStart, "yyyy-MM-dd"),
      to_date: format(weekEnd, "yyyy-MM-dd"),
    },
    slotsEnabled
  );

  const bookMutation = useBookMeeting();

  // Group slots by date
  const slotsByDate = new Map<string, AvailableSlot[]>();
  for (const slot of slotsData?.slots ?? []) {
    const key = slot.date;
    if (!slotsByDate.has(key)) slotsByDate.set(key, []);
    slotsByDate.get(key)!.push(slot);
  }

  // Build the 14-day calendar grid
  const days = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));

  const handleBooking = async () => {
    if (!selectedType || !selectedSlot) return;
    try {
      await bookMutation.mutateAsync({
        meeting_type_id: selectedType.id,
        start_time: selectedSlot.start_time,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        agenda: agenda || undefined,
      });
      setBooked(true);
      onBooked?.();
    } catch {
      // error is exposed via bookMutation.error
    }
  };

  // ─── Booked confirmation ────────────────────────────────────────────────────
  if (booked) {
    return (
      <Card className="max-w-md mx-auto text-center py-8">
        <CardContent className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <div>
            <h2 className="text-xl font-semibold">Meeting Requested</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Your{" "}
              <span className="font-medium">{selectedType?.label}</span> on{" "}
              <span className="font-medium">
                {selectedSlot
                  ? format(parseISO(selectedSlot.start_time), "EEE MMM d 'at' h:mm a")
                  : ""}
              </span>{" "}
              has been submitted and is awaiting confirmation from your RM.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setStep("type");
              setSelectedType(null);
              setSelectedSlot(null);
              setAgenda("");
              setBooked(false);
              setWeekOffset(0);
            }}
          >
            Book Another Meeting
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {(["type", "slot", "agenda", "confirm"] as Step[]).map((s, i) => (
          <span
            key={s}
            className={cn(
              "flex items-center gap-2",
              step === s && "text-foreground font-medium"
            )}
          >
            {i > 0 && <span>/</span>}
            <span
              className={cn(
                "capitalize",
                step === s && "text-foreground font-medium"
              )}
            >
              {s === "type"
                ? "Meeting type"
                : s === "slot"
                  ? "Pick a time"
                  : s === "agenda"
                    ? "Add details"
                    : "Confirm"}
            </span>
          </span>
        ))}
      </div>

      {/* ── Step 1: Choose meeting type ───────────────────────────────────── */}
      {step === "type" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Choose a meeting type</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select how long you&apos;d like to meet with your Relationship Manager.
            </p>
          </div>
          {typesLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="grid gap-3">
              {meetingTypes?.map((type) => (
                <Card
                  key={type.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-sm border-2",
                    selectedType?.id === type.id
                      ? "border-primary"
                      : "border-border"
                  )}
                  onClick={() => setSelectedType(type)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{type.label}</CardTitle>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full border",
                          durationBadgeColor(type.duration_minutes)
                        )}
                      >
                        <Clock className="inline h-3 w-3 mr-1" />
                        {type.duration_minutes} min
                      </span>
                    </div>
                  </CardHeader>
                  {type.description && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              disabled={!selectedType}
              onClick={() => setStep("slot")}
            >
              Next: Pick a time
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Pick a slot ───────────────────────────────────────────── */}
      {step === "slot" && selectedType && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pick a time</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Available slots for a{" "}
                <span className="font-medium">{selectedType.label}</span> (
                {selectedType.duration_minutes} min).
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("type")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>

          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              disabled={weekOffset === 0}
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {format(weekStart, "MMM d")} –{" "}
              {format(weekEnd, "MMM d, yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {slotsLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Loading available slots…
            </div>
          ) : !slotsData?.slots.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No available slots in this period. Try the next week.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const daySlots = slotsByDate.get(key) ?? [];
                const isToday = isSameDay(day, today);
                return (
                  <div key={key} className="min-h-[80px]">
                    <div
                      className={cn(
                        "text-xs text-center mb-1 font-medium",
                        isToday && "text-primary"
                      )}
                    >
                      <div>{DOW_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                      <div
                        className={cn(
                          "rounded-full w-6 h-6 flex items-center justify-center mx-auto text-xs",
                          isToday && "bg-primary text-primary-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {daySlots.map((slot) => {
                        const isSelected =
                          selectedSlot?.start_time === slot.start_time;
                        return (
                          <button
                            key={slot.start_time}
                            className={cn(
                              "w-full text-xs rounded py-1 px-1 border transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-accent border-border"
                            )}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {format(parseISO(slot.start_time), "HH:mm")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={!selectedSlot}
              onClick={() => setStep("agenda")}
            >
              Next: Add details
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Agenda/notes ──────────────────────────────────────────── */}
      {step === "agenda" && selectedSlot && selectedType && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Add details</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Optionally share an agenda so your RM can prepare.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("slot")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4 pb-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(
                    parseISO(selectedSlot.start_time),
                    "EEEE, MMMM d 'at' h:mm a"
                  )}
                </span>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {selectedType.duration_minutes} min
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="agenda">Agenda / notes (optional)</Label>
            <Textarea
              id="agenda"
              placeholder="What would you like to discuss?"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {agenda.length}/2000
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep("confirm")}>
              Review booking
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Confirm ───────────────────────────────────────────────── */}
      {step === "confirm" && selectedSlot && selectedType && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Confirm your booking</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Review the details below, then confirm.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("agenda")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4 text-muted-foreground" />
                {selectedType.label}
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto text-xs",
                    durationBadgeColor(selectedType.duration_minutes)
                  )}
                >
                  {selectedType.duration_minutes} min
                </Badge>
              </CardTitle>
              <CardDescription>
                {selectedType.description}
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>
                  {format(
                    parseISO(selectedSlot.start_time),
                    "EEEE, MMMM d, yyyy"
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>
                  {format(parseISO(selectedSlot.start_time), "h:mm a")} –{" "}
                  {format(parseISO(selectedSlot.end_time), "h:mm a")} (
                  {Intl.DateTimeFormat().resolvedOptions().timeZone})
                </span>
              </div>
              {agenda && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Agenda</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {agenda}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              {bookMutation.error && (
                <p className="text-sm text-destructive mr-auto">
                  {bookMutation.error instanceof Error
                    ? bookMutation.error.message
                    : "Booking failed. Please try again."}
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => setStep("slot")}
                disabled={bookMutation.isPending}
              >
                Change time
              </Button>
              <Button
                onClick={handleBooking}
                disabled={bookMutation.isPending}
              >
                {bookMutation.isPending ? "Booking…" : "Confirm meeting"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── My Meetings list ─────────────────────────────────────────────────────────

import { useCancelMeeting, useMyMeetings, useRescheduleMeeting } from "@/hooks/use-meetings";
import type { Meeting } from "@/types/meeting";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending confirmation",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  completed: {
    label: "Completed",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

interface MeetingCardProps {
  meeting: Meeting;
}

function MeetingCard({ meeting }: MeetingCardProps) {
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
            <CardTitle className="text-base">
              {mt?.label ?? "Meeting"}
            </CardTitle>
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
                      !newDate ||
                      !newTime ||
                      rescheduleMutation.isPending
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
                      {cancelMutation.isPending ? "Cancelling…" : "Cancel meeting"}
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

export function MyMeetingsList() {
  const { data, isLoading } = useMyMeetings({ limit: 20 });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading meetings…</div>
    );
  }

  if (!data?.meetings.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No meetings yet. Book one above.
        </CardContent>
      </Card>
    );
  }

  const upcoming = data.meetings.filter(
    (m) => !["cancelled", "completed"].includes(m.status)
  );
  const past = data.meetings.filter((m) =>
    ["cancelled", "completed"].includes(m.status)
  );

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Upcoming
          </h3>
          {upcoming.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Past
          </h3>
          {past.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}

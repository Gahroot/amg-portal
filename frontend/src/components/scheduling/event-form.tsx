"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEvent } from "@/hooks/use-scheduling";
import type { EventType } from "@/types/scheduling";

const eventTypes: { value: EventType; label: string }[] = [
  { value: "meeting", label: "Meeting" },
  { value: "call", label: "Call" },
  { value: "site_visit", label: "Site Visit" },
  { value: "review", label: "Review" },
  { value: "deadline", label: "Deadline" },
];

interface EventFormProps {
  trigger?: React.ReactNode;
}

export function EventForm({ trigger }: EventFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("meeting");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [virtualLink, setVirtualLink] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("30");

  const createMutation = useCreateEvent();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEventType("meeting");
    setStartTime("");
    setEndTime("");
    setLocation("");
    setVirtualLink("");
    setNotes("");
    setReminderMinutes("30");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startTime || !endTime) return;

    createMutation.mutate(
      {
        title,
        description: description || undefined,
        event_type: eventType,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        location: location || undefined,
        virtual_link: virtualLink || undefined,
        notes: notes || undefined,
        reminder_minutes: parseInt(reminderMinutes, 10),
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>New Event</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Schedule a new event for your team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-type">Type</Label>
              <Select
                value={eventType}
                onValueChange={(v) => setEventType(v as EventType)}
              >
                <SelectTrigger id="event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start-time">Start</Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end-time">End</Label>
                <Input
                  id="end-time"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Office, venue, etc."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="virtual-link">Virtual Link</Label>
              <Input
                id="virtual-link"
                value={virtualLink}
                onChange={(e) => setVirtualLink(e.target.value)}
                placeholder="https://meet.example.com/..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Event details..."
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder">Reminder (minutes before)</Label>
              <Input
                id="reminder"
                type="number"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(e.target.value)}
                min="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

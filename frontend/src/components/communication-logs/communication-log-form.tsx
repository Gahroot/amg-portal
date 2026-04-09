"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CommunicationLogCreateData,
  CommunicationLogChannel,
  CommunicationLogDirection,
  CommunicationLog,
} from "@/types/communication-log";

const CHANNELS: { value: CommunicationLogChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "video_call", label: "Video Call" },
  { value: "in_person", label: "In Person" },
  { value: "letter", label: "Letter" },
];

const DIRECTIONS: { value: CommunicationLogDirection; label: string }[] = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
];

interface CommunicationLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CommunicationLogCreateData) => void;
  isLoading?: boolean;
  initialData?: CommunicationLog | null;
}

export function CommunicationLogForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  initialData,
}: CommunicationLogFormProps) {
  const [channel, setChannel] = useState<CommunicationLogChannel>(
    initialData?.channel ?? "email"
  );
  const [direction, setDirection] = useState<CommunicationLogDirection>(
    initialData?.direction ?? "outbound"
  );
  const [subject, setSubject] = useState(initialData?.subject ?? "");
  const [summary, setSummary] = useState(initialData?.summary ?? "");
  const [contactName, setContactName] = useState(
    initialData?.contact_name ?? ""
  );
  const [contactEmail, setContactEmail] = useState(
    initialData?.contact_email ?? ""
  );
  const [occurredAt, setOccurredAt] = useState(
    initialData?.occurred_at
      ? new Date(initialData.occurred_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [tags, setTags] = useState(initialData?.tags?.join(", ") ?? "");

  useEffect(() => {
    if (open) {
      setChannel(initialData?.channel ?? "email");
      setDirection(initialData?.direction ?? "outbound");
      setSubject(initialData?.subject ?? "");
      setSummary(initialData?.summary ?? "");
      setContactName(initialData?.contact_name ?? "");
      setContactEmail(initialData?.contact_email ?? "");
      setOccurredAt(
        initialData?.occurred_at
          ? new Date(initialData.occurred_at).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16)
      );
      setTags(initialData?.tags?.join(", ") ?? "");
    }
  }, [open, initialData]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data: CommunicationLogCreateData = {
      channel,
      direction,
      subject,
      summary: summary || undefined,
      contact_name: contactName || undefined,
      contact_email: contactEmail || undefined,
      occurred_at: new Date(occurredAt).toISOString(),
      tags: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    };
    onSubmit(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Communication Log" : "New Communication Log"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="channel">Channel</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as CommunicationLogChannel)}
              >
                <SelectTrigger id="channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) =>
                  setDirection(v as CommunicationLogDirection)
                }
              >
                <SelectTrigger id="direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="Brief description of the communication"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Detailed notes about the communication..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name of external contact"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurredAt">Date & Time *</Label>
            <Input
              id="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags (e.g., follow-up, urgent)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !subject}>
              {isLoading
                ? "Saving..."
                : initialData
                  ? "Update"
                  : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

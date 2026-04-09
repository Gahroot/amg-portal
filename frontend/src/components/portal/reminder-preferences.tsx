"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, Monitor, Smartphone, Settings2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-settings";
import type { UserNotificationPreferencesUpdate } from "@/types/user";

// ─── Constants ──────────────────────────────────────────────────────────────

const REMINDER_DAYS_OPTIONS = [
  { value: 14, label: "14 days before" },
  { value: 7, label: "7 days before" },
  { value: 3, label: "3 days before" },
  { value: 1, label: "1 day before" },
] as const;

const REMINDER_CHANNEL_OPTIONS = [
  {
    value: "email",
    label: "Email",
    description: "Sent to your inbox",
    icon: Mail,
  },
  {
    value: "in_app",
    label: "In-App",
    description: "Portal notification bell",
    icon: Monitor,
  },
  {
    value: "push",
    label: "Push",
    description: "Mobile push notification",
    icon: Smartphone,
  },
] as const;

type ReminderDay = (typeof REMINDER_DAYS_OPTIONS)[number]["value"];
type ReminderChannel = (typeof REMINDER_CHANNEL_OPTIONS)[number]["value"];

const DEFAULT_DAYS: ReminderDay[] = [7, 1];
const DEFAULT_CHANNELS: ReminderChannel[] = ["email", "in_app"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function toValidDays(raw: number[] | null | undefined): ReminderDay[] {
  const valid = REMINDER_DAYS_OPTIONS.map((o) => o.value);
  return (raw ?? DEFAULT_DAYS).filter((d): d is ReminderDay =>
    (valid as number[]).includes(d)
  );
}

function toValidChannels(raw: string[] | null | undefined): ReminderChannel[] {
  const valid = REMINDER_CHANNEL_OPTIONS.map((o) => o.value);
  return (raw ?? DEFAULT_CHANNELS).filter((c): c is ReminderChannel =>
    (valid as string[]).includes(c)
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReminderPreferences() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  // Local state derived from server preferences
  const [selectedDays, setSelectedDays] = useState<ReminderDay[]>(DEFAULT_DAYS);
  const [selectedChannels, setSelectedChannels] = useState<ReminderChannel[]>(DEFAULT_CHANNELS);
  const [isDirty, setIsDirty] = useState(false);

  // Populate from server data once loaded
  useEffect(() => {
    if (!prefs) return;
    setSelectedDays(toValidDays(prefs.milestone_reminder_days));
    setSelectedChannels(toValidChannels(prefs.milestone_reminder_channels));
    setIsDirty(false);
  }, [prefs]);

  // Toggle helpers
  const toggleDay = (day: ReminderDay) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => b - a)
    );
    setIsDirty(true);
  };

  const toggleChannel = (channel: ReminderChannel) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
    setIsDirty(true);
  };

  const handleSave = () => {
    // At least one day and one channel must be selected
    const days = selectedDays.length > 0 ? selectedDays : DEFAULT_DAYS;
    const channels = selectedChannels.length > 0 ? selectedChannels : DEFAULT_CHANNELS;

    const update: UserNotificationPreferencesUpdate = {
      milestone_reminder_days: days,
      milestone_reminder_channels: channels,
    };

    updateMutation.mutate(update, {
      onSuccess: () => setIsDirty(false),
    });
  };

  const handleReset = () => {
    setSelectedDays(toValidDays(prefs?.milestone_reminder_days));
    setSelectedChannels(toValidChannels(prefs?.milestone_reminder_channels));
    setIsDirty(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Milestone Reminders</CardTitle>
        </div>
        <CardDescription>
          Choose when and how you receive reminders before milestone due dates.
          Reminders are sent automatically based on your selections.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading preferences…</p>
        ) : (
          <>
            {updateMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : "Failed to save reminder preferences. Please try again."}
                </AlertDescription>
              </Alert>
            )}

            {/* ── Reminder Timing ─────────────────────────────────────── */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Reminder Timing</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select how far in advance you want to be reminded.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REMINDER_DAYS_OPTIONS.map(({ value, label }) => {
                  const checked = selectedDays.includes(value);
                  return (
                    <label
                      key={value}
                      htmlFor={`reminder-day-${value}`}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        checked
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        id={`reminder-day-${value}`}
                        checked={checked}
                        onCheckedChange={() => toggleDay(value)}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
              {selectedDays.length === 0 && (
                <p className="text-xs text-destructive">
                  Select at least one reminder timing. Defaults (7 days, 1 day) will be used.
                </p>
              )}
            </div>

            <Separator />

            {/* ── Reminder Channels ───────────────────────────────────── */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Reminder Channels</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select where you want to receive milestone reminders.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {REMINDER_CHANNEL_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                  const checked = selectedChannels.includes(value);
                  return (
                    <label
                      key={value}
                      htmlFor={`reminder-channel-${value}`}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`reminder-channel-${value}`}
                          checked={checked}
                          onCheckedChange={() => toggleChannel(value)}
                        />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      <span className="ml-6 text-xs text-muted-foreground">{description}</span>
                    </label>
                  );
                })}
              </div>
              {selectedChannels.length === 0 && (
                <p className="text-xs text-destructive">
                  Select at least one channel. Defaults (Email, In-App) will be used.
                </p>
              )}
            </div>

            <Separator />

            {/* ── Summary ─────────────────────────────────────────────── */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Active configuration</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(selectedDays.length > 0 ? selectedDays : DEFAULT_DAYS)
                  .sort((a, b) => b - a)
                  .map((d) => (
                    <Badge key={d} variant="secondary">
                      {d} {d === 1 ? "day" : "days"} before
                    </Badge>
                  ))}
                <span className="text-muted-foreground text-xs self-center">via</span>
                {(selectedChannels.length > 0 ? selectedChannels : DEFAULT_CHANNELS).map((c) => (
                  <Badge key={c} variant="outline">
                    {REMINDER_CHANNEL_OPTIONS.find((o) => o.value === c)?.label ?? c}
                  </Badge>
                ))}
              </div>
            </div>

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleSave}
                disabled={!isDirty || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save Preferences"}
              </Button>
              {isDirty && (
                <Button type="button" variant="ghost" onClick={handleReset}>
                  Discard changes
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

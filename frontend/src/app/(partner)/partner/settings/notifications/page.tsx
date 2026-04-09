"use client";

import { useEffect, useState } from "react";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const DIGEST_FREQUENCIES = [
  { value: "immediate", label: "Immediate" },
  { value: "daily", label: "Daily Digest" },
  { value: "weekly", label: "Weekly Digest" },
  { value: "never", label: "Never" },
];

export default function PartnerNotificationsPage() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState("daily");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");
  const [timezone, setTimezone] = useState("UTC");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (preferences) {
      setDigestEnabled(preferences.digest_enabled);
      setDigestFrequency(preferences.digest_frequency);
      setEmailEnabled(preferences.channel_preferences?.email ?? true);
      setPortalEnabled(preferences.channel_preferences?.in_portal ?? true);
      setPushEnabled(preferences.channel_preferences?.push ?? true);
      setQuietHoursEnabled(preferences.quiet_hours_enabled);
      setQuietHoursStart(preferences.quiet_hours_start ?? "22:00");
      setQuietHoursEnd(preferences.quiet_hours_end ?? "07:00");
      setTimezone(preferences.timezone);
      setHasChanges(false);
    }
  }, [preferences]);

  const markChanged = () => setHasChanges(true);

  const handleSave = () => {
    updatePreferences.mutate(
      {
        digest_enabled: digestEnabled,
        digest_frequency: digestFrequency,
        channel_preferences: {
          email: emailEnabled,
          in_portal: portalEnabled,
          push: pushEnabled,
        },
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: quietHoursEnabled ? quietHoursStart : undefined,
        quiet_hours_end: quietHoursEnabled ? quietHoursEnd : undefined,
        timezone,
      },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading preferences...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Control how and when you receive notifications about your assignments and deliverables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Digest Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Notification Digest</h4>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="digest-enabled">Enable Digest</Label>
              <p className="text-xs text-muted-foreground">
                Receive a summary of notifications instead of individual alerts
              </p>
            </div>
            <Switch
              id="digest-enabled"
              checked={digestEnabled}
              onCheckedChange={(v) => {
                setDigestEnabled(v);
                markChanged();
              }}
            />
          </div>
          {digestEnabled && (
            <div className="space-y-2">
              <Label>Digest Frequency</Label>
              <Select
                value={digestFrequency}
                onValueChange={(v) => {
                  setDigestFrequency(v);
                  markChanged();
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIGEST_FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Channel Preferences */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Notification Channels</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-channel">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                id="email-channel"
                checked={emailEnabled}
                onCheckedChange={(v) => {
                  setEmailEnabled(v);
                  markChanged();
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="portal-channel">In-Portal Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  See notifications in the portal bell icon
                </p>
              </div>
              <Switch
                id="portal-channel"
                checked={portalEnabled}
                onCheckedChange={(v) => {
                  setPortalEnabled(v);
                  markChanged();
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-channel">Push Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive push notifications on mobile devices
                </p>
              </div>
              <Switch
                id="push-channel"
                checked={pushEnabled}
                onCheckedChange={(v) => {
                  setPushEnabled(v);
                  markChanged();
                }}
              />
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Quiet Hours</h4>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
              <p className="text-xs text-muted-foreground">
                Pause notifications during specified hours
              </p>
            </div>
            <Switch
              id="quiet-hours"
              checked={quietHoursEnabled}
              onCheckedChange={(v) => {
                setQuietHoursEnabled(v);
                markChanged();
              }}
            />
          </div>
          {quietHoursEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start Time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => {
                    setQuietHoursStart(e.target.value);
                    markChanged();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End Time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => {
                    setQuietHoursEnd(e.target.value);
                    markChanged();
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select
            value={timezone}
            onValueChange={(v) => {
              setTimezone(v);
              markChanged();
            }}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || updatePreferences.isPending}
        >
          {updatePreferences.isPending ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}

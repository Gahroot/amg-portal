"use client";

import { useEffect, useState } from "react";
import {
  useClientCommunicationPreferences,
  useUpdateClientCommunicationPreferences,
} from "@/hooks/use-communication-audit";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PreferredChannel, CommunicationPreferencesUpdate } from "@/types/communication-audit";

const CHANNEL_OPTIONS: { value: PreferredChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "portal", label: "Portal" },
  { value: "sms", label: "SMS" },
];

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Zurich",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Dubai",
];

interface ClientPreferencesFormProps {
  clientId: string;
  readOnly?: boolean;
}

export function ClientPreferencesForm({
  clientId,
  readOnly = false,
}: ClientPreferencesFormProps) {
  const { data: preferences, isLoading } =
    useClientCommunicationPreferences(clientId);
  const updateMutation = useUpdateClientCommunicationPreferences(clientId);

  const [formData, setFormData] = useState<CommunicationPreferencesUpdate>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (preferences) {
      setFormData({
        preferred_channels: preferences.preferred_channels,
        contact_hours_start: preferences.contact_hours_start,
        contact_hours_end: preferences.contact_hours_end,
        contact_timezone: preferences.contact_timezone,
        language_preference: preferences.language_preference,
        do_not_contact: preferences.do_not_contact,
        opt_out_marketing: preferences.opt_out_marketing,
        special_instructions: preferences.special_instructions,
      });
      setIsDirty(false);
    }
  }, [preferences]);

  const handleChannelToggle = (channel: PreferredChannel) => {
    const current = formData.preferred_channels ?? [];
    const updated = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    setFormData((prev) => ({ ...prev, preferred_channels: updated }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync(formData);
    setIsDirty(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Communication Preferences</CardTitle>
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
        <CardTitle className="flex items-center justify-between">
          <span>Communication Preferences</span>
          {!readOnly && isDirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Do Not Contact */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Do Not Contact</Label>
            <p className="text-xs text-muted-foreground">
              Block all outbound communications to this client
            </p>
          </div>
          <Switch
            checked={formData.do_not_contact ?? false}
            onCheckedChange={(checked) => {
              setFormData((prev) => ({ ...prev, do_not_contact: checked }));
              setIsDirty(true);
            }}
            disabled={readOnly}
          />
        </div>

        {/* Opt Out Marketing */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Opt Out of Marketing</Label>
            <p className="text-xs text-muted-foreground">
              Exclude from marketing communications
            </p>
          </div>
          <Switch
            checked={formData.opt_out_marketing ?? false}
            onCheckedChange={(checked) => {
              setFormData((prev) => ({ ...prev, opt_out_marketing: checked }));
              setIsDirty(true);
            }}
            disabled={readOnly}
          />
        </div>

        {/* Preferred Channels */}
        <div className="space-y-2">
          <Label>Preferred Channels</Label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((ch) => {
              const isActive = (formData.preferred_channels ?? []).includes(
                ch.value
              );
              return (
                <Button
                  key={ch.value}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => !readOnly && handleChannelToggle(ch.value)}
                  disabled={readOnly}
                >
                  {ch.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Contact Hours */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="contact_hours_start">Contact Hours Start</Label>
            <input
              id="contact_hours_start"
              type="time"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={formData.contact_hours_start ?? ""}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  contact_hours_start: e.target.value || null,
                }));
                setIsDirty(true);
              }}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_hours_end">Contact Hours End</Label>
            <input
              id="contact_hours_end"
              type="time"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={formData.contact_hours_end ?? ""}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  contact_hours_end: e.target.value || null,
                }));
                setIsDirty(true);
              }}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-1">
          <Label htmlFor="contact_timezone">Timezone</Label>
          <select
            id="contact_timezone"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={formData.contact_timezone ?? ""}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                contact_timezone: e.target.value || null,
              }));
              setIsDirty(true);
            }}
            disabled={readOnly}
          >
            <option value="">Not set</option>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div className="space-y-1">
          <Label htmlFor="language_preference">Language Preference</Label>
          <input
            id="language_preference"
            type="text"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            placeholder="e.g. en, fr, de"
            value={formData.language_preference ?? ""}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                language_preference: e.target.value || null,
              }));
              setIsDirty(true);
            }}
            disabled={readOnly}
          />
        </div>

        {/* Special Instructions */}
        <div className="space-y-1">
          <Label htmlFor="special_instructions">Special Instructions</Label>
          <Textarea
            id="special_instructions"
            placeholder="Any special communication instructions..."
            value={formData.special_instructions ?? ""}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                special_instructions: e.target.value || null,
              }));
              setIsDirty(true);
            }}
            disabled={readOnly}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}

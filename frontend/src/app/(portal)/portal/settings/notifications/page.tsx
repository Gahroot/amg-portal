"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Mail, Monitor, Smartphone } from "lucide-react";
import { ReminderPreferences } from "@/components/portal/reminder-preferences";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

// ─── Constants ─────────────────────────────────────────────────────────────

const DIGEST_FREQUENCY_OPTIONS = ["immediate", "daily", "weekly"] as const;
type DigestFrequency = (typeof DIGEST_FREQUENCY_OPTIONS)[number];

const CADENCE_OPTIONS = ["immediate", "daily", "weekly"] as const;
type Cadence = (typeof CADENCE_OPTIONS)[number];

const CHANNEL_OPTIONS = ["email", "in_portal", "push"] as const;
type Channel = (typeof CHANNEL_OPTIONS)[number];

const DIGEST_FREQUENCY_LABELS: Record<
  DigestFrequency,
  { label: string; description: string }
> = {
  immediate: { label: "Immediate", description: "As soon as events occur" },
  daily: { label: "Daily digest", description: "Bundled once per day" },
  weekly: { label: "Weekly digest", description: "Bundled once per week" },
};

const CADENCE_LABELS: Record<Cadence, string> = {
  immediate: "Immediate",
  daily: "Daily",
  weekly: "Weekly",
};

const CHANNEL_CONFIG: {
  value: Channel;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "email",
    label: "Email",
    description: "Notifications sent to your inbox",
    icon: Mail,
  },
  {
    value: "in_portal",
    label: "In-Portal",
    description: "Notifications in the portal bell",
    icon: Monitor,
  },
  {
    value: "push",
    label: "Push",
    description: "Mobile push notifications",
    icon: Smartphone,
  },
];

// ─── Schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  email_digest_frequency: z.enum(DIGEST_FREQUENCY_OPTIONS, {
    error: "Please select a digest frequency.",
  }),
  status_update_cadence: z.enum(CADENCE_OPTIONS, {
    error: "Please select a status update cadence.",
  }),
  preferred_channel: z.enum(CHANNEL_OPTIONS, {
    error: "Please select a preferred channel.",
  }),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Derive a primary channel from the channel_preferences boolean map. */
function derivePreferredChannel(
  channelPrefs: Record<string, boolean> | null | undefined
): Channel {
  if (!channelPrefs) return "email";
  for (const ch of CHANNEL_OPTIONS) {
    if (channelPrefs[ch] === true) return ch;
  }
  return "email";
}

/**
 * Build a channel_preferences map that marks only the preferred channel as
 * enabled (preserving any non-standard keys from the existing preferences).
 */
function buildChannelPrefs(
  preferred: Channel,
  existing: Record<string, boolean> | null | undefined
): Record<string, boolean> {
  const standardKeys: Record<Channel, boolean> = {
    email: preferred === "email",
    in_portal: preferred === "in_portal",
    push: preferred === "push",
  };

  if (!existing) return standardKeys;

  // Keep any extra keys from the server but override the three standard ones
  const extra = Object.fromEntries(
    Object.entries(existing).filter(
      ([k]) => !(CHANNEL_OPTIONS as readonly string[]).includes(k)
    )
  );
  return { ...extra, ...standardKeys };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PortalNotificationsPage() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email_digest_frequency: "daily",
      status_update_cadence: "daily",
      preferred_channel: "email",
    },
  });

  // Populate form once preferences are fetched
  React.useEffect(() => {
    if (!prefs) return;

    const digestFreq = (DIGEST_FREQUENCY_OPTIONS as readonly string[]).includes(
      prefs.digest_frequency
    )
      ? (prefs.digest_frequency as DigestFrequency)
      : "daily";

    const rawCadence =
      prefs.notification_type_preferences?.["milestone_update"] ?? "daily";
    const cadence = (CADENCE_OPTIONS as readonly string[]).includes(rawCadence)
      ? (rawCadence as Cadence)
      : "daily";

    const preferred = derivePreferredChannel(prefs.channel_preferences);

    form.reset({ email_digest_frequency: digestFreq, status_update_cadence: cadence, preferred_channel: preferred });
  }, [prefs, form]);

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate({
      digest_frequency: values.email_digest_frequency,
      notification_type_preferences: {
        ...(prefs?.notification_type_preferences ?? {}),
        milestone_update: values.status_update_cadence,
      },
      channel_preferences: buildChannelPrefs(
        values.preferred_channel,
        prefs?.channel_preferences
      ),
    });
  };

  return (
    <div className="space-y-6">
      <ReminderPreferences />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Control how and when you receive notifications from your program
            team.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading preferences…
            </p>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                {updateMutation.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {updateMutation.error instanceof Error
                        ? updateMutation.error.message
                        : "Failed to save preferences. Please try again."}
                    </AlertDescription>
                  </Alert>
                )}

                {/* ── Email Digest Frequency ── */}
                <FormField
                  control={form.control}
                  name="email_digest_frequency"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-base font-semibold">
                        Email Digest Frequency
                      </FormLabel>
                      <FormDescription>
                        How often should program activity be bundled and sent to
                        your inbox?
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid gap-3 sm:grid-cols-3"
                        >
                          {DIGEST_FREQUENCY_OPTIONS.map((option) => {
                            const { label, description } =
                              DIGEST_FREQUENCY_LABELS[option];
                            const isSelected = field.value === option;
                            return (
                              <Label
                                key={option}
                                htmlFor={`digest-${option}`}
                                className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem
                                    value={option}
                                    id={`digest-${option}`}
                                  />
                                  <span className="font-medium text-sm">
                                    {label}
                                  </span>
                                </div>
                                <span className="ml-6 text-xs text-muted-foreground">
                                  {description}
                                </span>
                              </Label>
                            );
                          })}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* ── Status Update Cadence ── */}
                <FormField
                  control={form.control}
                  name="status_update_cadence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">
                        Status Update Cadence
                      </FormLabel>
                      <FormDescription>
                        How frequently should you receive milestone and program
                        status updates?
                      </FormDescription>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full sm:w-[220px]">
                            <SelectValue placeholder="Select cadence" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CADENCE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {CADENCE_LABELS[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* ── Preferred Channel ── */}
                <FormField
                  control={form.control}
                  name="preferred_channel"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-base font-semibold">
                        Preferred Channel
                      </FormLabel>
                      <FormDescription>
                        Where do you primarily want to receive notifications?
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid gap-3 sm:grid-cols-3"
                        >
                          {CHANNEL_CONFIG.map(
                            ({ value, label, description, icon: Icon }) => {
                              const isSelected = field.value === value;
                              return (
                                <Label
                                  key={value}
                                  htmlFor={`channel-${value}`}
                                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors ${
                                    isSelected
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <RadioGroupItem
                                      value={value}
                                      id={`channel-${value}`}
                                    />
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">
                                      {label}
                                    </span>
                                  </div>
                                  <span className="ml-6 text-xs text-muted-foreground">
                                    {description}
                                  </span>
                                </Label>
                              );
                            }
                          )}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={
                      !form.formState.isDirty || updateMutation.isPending
                    }
                  >
                    {updateMutation.isPending ? "Saving…" : "Save Preferences"}
                  </Button>
                  {form.formState.isDirty && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => form.reset()}
                    >
                      Discard changes
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

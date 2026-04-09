"use client";

import { useEffect } from "react";
import type { ComponentType } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bell,
  Mail,
  Monitor,
  Smartphone,
  CheckCircle2,
  MessageSquare,
  ClipboardCheck,
  FileText,
  Moon,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

// ─── Constants ─────────────────────────────────────────────────────────────

const DIGEST_FREQUENCY_OPTIONS = [
  "immediate",
  "hourly",
  "daily",
  "weekly",
  "never",
] as const;
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
  hourly: { label: "Hourly digest", description: "Bundled every hour" },
  daily: { label: "Daily digest", description: "Bundled once per day" },
  weekly: { label: "Weekly digest", description: "Bundled once per week" },
  never: { label: "Paused", description: "Pause all email notifications" },
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
  icon: ComponentType<{ className?: string }>;
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

const CADENCE_CONFIG: {
  key: "cadence_milestone_update" | "cadence_communication" | "cadence_decision_pending" | "cadence_deliverable_ready";
  prefKey: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    key: "cadence_milestone_update",
    prefKey: "milestone_update",
    label: "Milestone Updates",
    description: "Status changes, at-risk flags, and completions",
    icon: CheckCircle2,
  },
  {
    key: "cadence_communication",
    prefKey: "communication",
    label: "Messages from RM",
    description: "New messages from your Relationship Manager",
    icon: MessageSquare,
  },
  {
    key: "cadence_decision_pending",
    prefKey: "decision_pending",
    label: "Approval Requests",
    description: "Decision requests requiring your input",
    icon: ClipboardCheck,
  },
  {
    key: "cadence_deliverable_ready",
    prefKey: "deliverable_ready",
    label: "Reports & Deliverables",
    description: "When a report or document is ready to review",
    icon: FileText,
  },
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
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

// ─── Schema ────────────────────────────────────────────────────────────────

const schema = z
  .object({
    email_digest_frequency: z.enum(DIGEST_FREQUENCY_OPTIONS, {
      error: "Please select a digest frequency.",
    }),
    cadence_milestone_update: z.enum(CADENCE_OPTIONS, {
      error: "Please select a milestone update cadence.",
    }),
    cadence_communication: z.enum(CADENCE_OPTIONS, {
      error: "Please select a communication cadence.",
    }),
    cadence_decision_pending: z.enum(CADENCE_OPTIONS, {
      error: "Please select an approval request cadence.",
    }),
    cadence_deliverable_ready: z.enum(CADENCE_OPTIONS, {
      error: "Please select a deliverable cadence.",
    }),
    preferred_channel: z.enum(CHANNEL_OPTIONS, {
      error: "Please select a preferred channel.",
    }),
    quiet_hours_enabled: z.boolean(),
    quiet_hours_start: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Use HH:MM format")
      .optional(),
    quiet_hours_end: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Use HH:MM format")
      .optional(),
    timezone: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.quiet_hours_enabled) {
      if (!data.quiet_hours_start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start time is required when quiet hours are enabled.",
          path: ["quiet_hours_start"],
        });
      }
      if (!data.quiet_hours_end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time is required when quiet hours are enabled.",
          path: ["quiet_hours_end"],
        });
      }
    }
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
      cadence_milestone_update: "daily",
      cadence_communication: "daily",
      cadence_decision_pending: "daily",
      cadence_deliverable_ready: "daily",
      preferred_channel: "email",
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "08:00",
      timezone: "UTC",
    },
  });

  // Populate form once preferences are fetched
  useEffect(() => {
    if (!prefs) return;

    const digestFreq = (DIGEST_FREQUENCY_OPTIONS as readonly string[]).includes(
      prefs.digest_frequency
    )
      ? (prefs.digest_frequency as DigestFrequency)
      : "daily";

    const cadenceFor = (key: string): Cadence => {
      const val = prefs.notification_type_preferences?.[key];
      return (CADENCE_OPTIONS as readonly string[]).includes(val ?? "")
        ? (val as Cadence)
        : "daily";
    };

    const preferred = derivePreferredChannel(prefs.channel_preferences);

    form.reset({
      email_digest_frequency: digestFreq,
      cadence_milestone_update: cadenceFor("milestone_update"),
      cadence_communication: cadenceFor("communication"),
      cadence_decision_pending: cadenceFor("decision_pending"),
      cadence_deliverable_ready: cadenceFor("deliverable_ready"),
      preferred_channel: preferred,
      quiet_hours_enabled: prefs.quiet_hours_enabled ?? false,
      quiet_hours_start: prefs.quiet_hours_start ?? "22:00",
      quiet_hours_end: prefs.quiet_hours_end ?? "08:00",
      timezone: prefs.timezone ?? "UTC",
    });
  }, [prefs, form]);

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate({
      digest_frequency: values.email_digest_frequency,
      digest_enabled: values.email_digest_frequency !== "never",
      notification_type_preferences: {
        ...(prefs?.notification_type_preferences ?? {}),
        milestone_update: values.cadence_milestone_update,
        communication: values.cadence_communication,
        decision_pending: values.cadence_decision_pending,
        deliverable_ready: values.cadence_deliverable_ready,
      },
      channel_preferences: buildChannelPrefs(
        values.preferred_channel,
        prefs?.channel_preferences
      ),
      quiet_hours_enabled: values.quiet_hours_enabled,
      quiet_hours_start: values.quiet_hours_enabled
        ? values.quiet_hours_start
        : undefined,
      quiet_hours_end: values.quiet_hours_enabled
        ? values.quiet_hours_end
        : undefined,
      timezone: values.timezone,
    });
  };

  const quietHoursEnabled = useWatch({ control: form.control, name: "quiet_hours_enabled" });

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
              Loading preferences...
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
                          className="grid gap-3 sm:grid-cols-5"
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

                {/* ── Notification Cadences ── */}
                <div className="space-y-4">
                  <FormLabel className="text-base font-semibold">
                    Notification Cadences
                  </FormLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {CADENCE_CONFIG.map(
                      ({ key, label, description, icon: Icon }) => (
                        <FormField
                          key={key}
                          control={form.control}
                          name={key}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <FormLabel className="text-sm font-medium">
                                  {label}
                                </FormLabel>
                              </div>
                              <FormDescription className="text-xs mb-2">
                                {description}
                              </FormDescription>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
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
                      )
                    )}
                  </div>
                </div>

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

                <Separator />

                {/* ── Quiet Hours ── */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="quiet_hours_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4 text-muted-foreground" />
                          <FormLabel className="text-base font-semibold">
                            Quiet Hours
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <p className="text-sm text-muted-foreground">
                    Pause non-urgent notifications during off-hours. Escalations
                    always break through.
                  </p>

                  {quietHoursEnabled && (
                    <div className="rounded-lg border p-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="quiet_hours_start"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  value={field.value ?? ""}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="quiet_hours_end"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  value={field.value ?? ""}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {TIMEZONE_OPTIONS.map((tz) => (
                                  <SelectItem key={tz} value={tz}>
                                    {tz}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={
                      !form.formState.isDirty || updateMutation.isPending
                    }
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Preferences"}
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

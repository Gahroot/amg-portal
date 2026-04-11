"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import {
  buildDefaultGranularPreferences,
  ALL_CHANNEL_KEYS,
  type NotificationChannelKey,
} from "@/lib/api/notification-preferences";

// ─── Notification category metadata ─────────────────────────────────────────

interface CategoryMeta {
  key: string;
  label: string;
  description: string;
  /** Roles that can see this category. Undefined = all internal roles. */
  roles?: string[];
}

const NOTIFICATION_CATEGORIES: CategoryMeta[] = [
  {
    key: "sla_warning",
    label: "SLA Warnings",
    description: "SLA breach and approaching deadline alerts",
    roles: ["managing_director", "relationship_manager", "coordinator", "finance_compliance"],
  },
  {
    key: "document_delivery",
    label: "Document Deliveries",
    description: "New documents delivered to you",
  },
  {
    key: "approval_request",
    label: "Approval Requests",
    description: "Approvals pending your review",
    roles: ["managing_director", "relationship_manager", "coordinator", "finance_compliance"],
  },
  {
    key: "escalation",
    label: "Escalations",
    description: "Escalations created or updated",
    roles: ["managing_director", "relationship_manager", "coordinator", "finance_compliance"],
  },
  {
    key: "milestone",
    label: "Milestone Updates",
    description: "Milestone status changes and completions",
  },
  {
    key: "message",
    label: "New Messages",
    description: "New messages in conversations",
    roles: ["managing_director", "relationship_manager", "coordinator", "finance_compliance"],
  },
  {
    key: "decision",
    label: "Decision Requests",
    description: "Decisions requiring your input",
  },
  {
    key: "program_update",
    label: "Program Updates",
    description: "Program status changes",
  },
  {
    key: "partner_assignment",
    label: "Partner Assignments",
    description: "New partner assignments",
    roles: ["partner"],
  },
  {
    key: "communication",
    label: "Communications",
    description: "Communications & messages",
  },
  {
    key: "deliverable_ready",
    label: "Deliverables Ready",
    description: "Deliverable ready for review",
  },
  {
    key: "assignment_update",
    label: "Assignment Updates",
    description: "Assignment status updates",
  },
  {
    key: "milestone_alert",
    label: "Milestone Alerts",
    description: "Milestone alerts and reminders",
  },
  {
    key: "weekly_status",
    label: "Weekly Status",
    description: "Weekly status reports",
    roles: ["managing_director", "relationship_manager", "coordinator", "finance_compliance"],
  },
  {
    key: "system",
    label: "System Alerts",
    description: "System-level alerts",
  },
];

const CHANNEL_LABELS: Record<NotificationChannelKey, string> = {
  push: "Push",
  email: "Email",
  in_app: "In-App",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function GranularNotificationPreferences() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const { user } = useAuth();

  const [granularPrefs, setGranularPrefs] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [hasChanges, setHasChanges] = useState(false);

  // Mute-all state per channel
  const [muteAll, setMuteAll] = useState<Record<NotificationChannelKey, boolean>>({
    push: false,
    email: false,
    in_app: false,
  });

  // Initialise granular preferences from backend data or defaults
  useEffect(() => {
    if (preferences) {
      setGranularPrefs((preferences as Record<string, unknown>).granular_preferences as Record<string, Record<string, boolean>> ?? buildDefaultGranularPreferences());
    }
  }, [preferences]);

  // Determine which categories this user can see
  const visibleCategories = useMemo(() => {
    if (!user) return [];
    return NOTIFICATION_CATEGORIES.filter((cat) => {
      if (!cat.roles) return true; // visible to all
      return cat.roles.includes(user.role);
    });
  }, [user]);

  // Toggle a single (category × channel) cell
  const handleToggle = (category: string, channel: string, checked: boolean) => {
    setGranularPrefs((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] ?? { push: true, email: true, in_app: true }),
        [channel]: checked,
      },
    }));
    setHasChanges(true);
  };

  // Mute/unmute all categories for a given channel
  const handleMuteAll = (channel: NotificationChannelKey, muted: boolean) => {
    setMuteAll((prev) => ({ ...prev, [channel]: muted }));
    setGranularPrefs((prev) => {
      const updated = { ...prev };
      for (const cat of visibleCategories) {
        updated[cat.key] = {
          ...(updated[cat.key] ?? { push: true, email: true, in_app: true }),
          [channel]: !muted,
        };
      }
      return updated;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updatePreferences.mutateAsync({
        granular_preferences: granularPrefs,
      } as Parameters<typeof updatePreferences.mutateAsync>[0]);
      setHasChanges(false);
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Per-Channel Preferences</CardTitle>
          <CardDescription>Loading your preferences…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Per-Channel Preferences</CardTitle>
        <CardDescription>
          Control exactly which notifications you receive, broken down by delivery channel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mute-all controls */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Quick Controls</h4>
          <p className="text-xs text-muted-foreground">
            Mute all notifications for a specific channel.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {ALL_CHANNEL_KEYS.map((channel) => (
              <div
                key={channel}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{CHANNEL_LABELS[channel]}</Label>
                  <p className="text-xs text-muted-foreground">
                    {channel === "push" && "Browser/mobile notifications"}
                    {channel === "email" && "Email notifications"}
                    {channel === "in_app" && "In-portal notifications"}
                  </p>
                </div>
                <Switch
                  checked={muteAll[channel]}
                  onCheckedChange={(checked) => handleMuteAll(channel, checked)}
                  aria-label={`Mute all ${CHANNEL_LABELS[channel]} notifications`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Category × Channel grid */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Category Preferences</h4>
          <p className="text-xs text-muted-foreground">
            Toggle notifications for each category and channel combination.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Category</th>
                  {ALL_CHANNEL_KEYS.map((ch) => (
                    <th key={ch} className="p-3 text-center font-medium">
                      {CHANNEL_LABELS[ch]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleCategories.map((category) => (
                  <tr key={category.key} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div>
                        <p className="text-sm font-medium">{category.label}</p>
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      </div>
                    </td>
                    {ALL_CHANNEL_KEYS.map((channel) => (
                      <td key={channel} className="p-3 text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={granularPrefs[category.key]?.[channel] ?? true}
                            onCheckedChange={(checked) =>
                              handleToggle(category.key, channel, checked)
                            }
                            disabled={muteAll[channel]}
                            aria-label={`${category.label} ${CHANNEL_LABELS[channel]}`}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updatePreferences.isPending}
          >
            {updatePreferences.isPending ? "Saving…" : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

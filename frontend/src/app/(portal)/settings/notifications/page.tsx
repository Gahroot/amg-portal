"use client";

import * as React from "react";
import {
  useClientPreferences,
  useUpdateClientPreferences,
  useEngagementHistory,
} from "@/hooks/use-schedules";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DIGEST_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "never", label: "Never" },
];

const REPORT_FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
];

function statusColor(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "completed":
    case "closed":
      return "secondary";
    case "on_hold":
      return "outline";
    default:
      return "outline";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PortalNotificationsPage() {
  const { data: preferences, isLoading: prefsLoading } = useClientPreferences();
  const updateMutation = useUpdateClientPreferences();
  const { data: history, isLoading: historyLoading } = useEngagementHistory();

  const [digestFrequency, setDigestFrequency] = React.useState<string>("daily");
  const [reportFormat, setReportFormat] = React.useState<string>("pdf");
  const [emailEnabled, setEmailEnabled] = React.useState(true);
  const [portalEnabled, setPortalEnabled] = React.useState(true);
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    if (preferences) {
      setDigestFrequency(preferences.digest_frequency ?? "daily");
      setReportFormat(preferences.report_format ?? "pdf");
      setEmailEnabled(preferences.notification_channels?.email ?? true);
      setPortalEnabled(preferences.notification_channels?.in_portal ?? true);
      setHasChanges(false);
    }
  }, [preferences]);

  const handleSave = () => {
    updateMutation.mutate(
      {
        digest_frequency: digestFrequency,
        report_format: reportFormat,
        notification_channels: {
          email: emailEnabled,
          in_portal: portalEnabled,
        },
      },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  const markChanged = () => setHasChanges(true);

  return (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Control how and when you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {prefsLoading ? (
            <p className="text-sm text-muted-foreground">Loading preferences...</p>
          ) : (
            <>
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

              <div className="space-y-2">
                <Label>Report Format</Label>
                <Select
                  value={reportFormat}
                  onValueChange={(v) => {
                    setReportFormat(v);
                    markChanged();
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label>Notification Channels</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="email-channel"
                      checked={emailEnabled}
                      onCheckedChange={(v) => {
                        setEmailEnabled(v);
                        markChanged();
                      }}
                    />
                    <Label htmlFor="email-channel">Email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="portal-channel"
                      checked={portalEnabled}
                      onCheckedChange={(v) => {
                        setPortalEnabled(v);
                        markChanged();
                      }}
                    />
                    <Label htmlFor="portal-channel">In-Portal</Label>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Preferences"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Engagement History */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement History</CardTitle>
          <CardDescription>Your programs and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Loading history...</p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.programs.map((item) => (
                      <TableRow key={item.program_id}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(item.status)}>
                            {item.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(item.start_date)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(item.end_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!history || history.programs.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          No programs found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {history && history.total > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {history.total} program{history.total !== 1 ? "s" : ""} total
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

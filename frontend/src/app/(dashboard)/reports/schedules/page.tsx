"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  useReportSchedules,
  useCreateReportSchedule,
  useUpdateReportSchedule,
  useDeleteReportSchedule,
} from "@/hooks/use-schedules";
import type { ReportScheduleCreate } from "@/lib/api/schedules";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

const REPORT_TYPES = [
  { value: "portfolio", label: "Portfolio Overview" },
  { value: "program_status", label: "Program Status" },
  { value: "completion", label: "Completion Report" },
  { value: "annual_review", label: "Annual Review" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReportType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function ReportSchedulesPage() {
  const { user } = useAuth();
  const { data: schedules, isLoading } = useReportSchedules();
  const createMutation = useCreateReportSchedule();
  const updateMutation = useUpdateReportSchedule();
  const deleteMutation = useDeleteReportSchedule();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formData, setFormData] = React.useState<ReportScheduleCreate>({
    report_type: "portfolio",
    frequency: "weekly",
    recipients: [],
    format: "pdf",
    entity_id: null,
  });
  const [recipientInput, setRecipientInput] = React.useState("");

  const handleAddRecipient = () => {
    const email = recipientInput.trim();
    if (email && !formData.recipients.includes(email)) {
      setFormData((prev) => ({
        ...prev,
        recipients: [...prev.recipients, email],
      }));
      setRecipientInput("");
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setFormData((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((r) => r !== email),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.recipients.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }
    createMutation.mutate(formData, {
      onSuccess: () => {
        setDialogOpen(false);
        setFormData({
          report_type: "portfolio",
          frequency: "weekly",
          recipients: [],
          format: "pdf",
          entity_id: null,
        });
      },
    });
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, data: { is_active: !isActive } });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this schedule?")) {
      deleteMutation.mutate(id);
    }
  };

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Report Schedules
          </h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Schedule</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Report Schedule</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select
                    value={formData.report_type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, report_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Entity ID (optional)</Label>
                  <Input
                    placeholder="Program ID or Client ID"
                    value={formData.entity_id ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        entity_id: e.target.value || null,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, frequency: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={formData.format}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, format: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Recipients</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddRecipient();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddRecipient}>
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {formData.recipients.map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleRemoveRecipient(email)}
                      >
                        {email} &times;
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading schedules...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules?.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {formatReportType(schedule.report_type)}
                    </TableCell>
                    <TableCell className="capitalize">{schedule.frequency}</TableCell>
                    <TableCell className="uppercase">{schedule.format}</TableCell>
                    <TableCell className="text-sm">{formatDate(schedule.next_run)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(schedule.last_run)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {schedule.recipients.slice(0, 2).map((r) => (
                          <Badge key={r} variant="outline" className="text-xs">
                            {r}
                          </Badge>
                        ))}
                        {schedule.recipients.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{schedule.recipients.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(schedule.id, schedule.is_active)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(schedule.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!schedules || schedules.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No report schedules found. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

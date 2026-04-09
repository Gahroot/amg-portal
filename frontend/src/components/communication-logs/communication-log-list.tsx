"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, Pencil } from "lucide-react";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import { API_BASE_URL } from "@/lib/constants";
import {
  useCommunicationLogs,
  useCreateCommunicationLog,
  useUpdateCommunicationLog,
  useDeleteCommunicationLog,
} from "@/hooks/use-communication-logs";
import { useDebounce } from "@/hooks/use-debounce";
import { CommunicationLogForm } from "./communication-log-form";
import type {
  CommunicationLog,
  CommunicationLogCreateData,
  CommunicationLogListParams,
} from "@/types/communication-log";

const EXPORT_COLUMNS: ExportColumn<CommunicationLog>[] = [
  { header: "Date", accessor: (r) => r.occurred_at ? new Date(r.occurred_at).toLocaleString() : "" },
  { header: "Channel", accessor: "channel" },
  { header: "Direction", accessor: "direction" },
  { header: "Subject", accessor: "subject" },
  { header: "Contact Name", accessor: (r) => r.contact_name ?? "" },
  { header: "Contact Email", accessor: (r) => r.contact_email ?? "" },
  { header: "Client", accessor: (r) => r.client_name ?? "" },
  { header: "Partner", accessor: (r) => r.partner_name ?? "" },
  { header: "Program", accessor: (r) => r.program_title ?? "" },
  { header: "Logged By", accessor: (r) => r.logger_name ?? "" },
  { header: "Summary", accessor: (r) => r.summary ?? "" },
  { header: "Tags", accessor: (r) => (r.tags ?? []).join(", ") },
];

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  video_call: "Video Call",
  in_person: "In Person",
  letter: "Letter",
};

const CHANNEL_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  email: "default",
  phone: "secondary",
  video_call: "secondary",
  in_person: "outline",
  letter: "outline",
};

const DIRECTION_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  inbound: "secondary",
  outbound: "default",
};

export function CommunicationLogList() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [channelFilter, setChannelFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<CommunicationLog | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const params: CommunicationLogListParams = {
    search: debouncedSearch || undefined,
    channel: channelFilter !== "all" ? channelFilter : undefined,
    direction: directionFilter !== "all" ? directionFilter : undefined,
  };

  const { data, isLoading } = useCommunicationLogs(params);
  const createMutation = useCreateCommunicationLog();
  const updateMutation = useUpdateCommunicationLog(editingLog?.id ?? "");
  const deleteMutation = useDeleteCommunicationLog();

  function handleCreate(formData: CommunicationLogCreateData) {
    createMutation.mutate(formData, {
      onSuccess: () => setFormOpen(false),
    });
  }

  function handleUpdate(formData: CommunicationLogCreateData) {
    updateMutation.mutate(formData, {
      onSuccess: () => {
        setEditingLog(null);
        setFormOpen(false);
      },
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  }

  function openEdit(log: CommunicationLog) {
    setEditingLog(log);
    setFormOpen(true);
  }

  function openCreate() {
    setEditingLog(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Communication Log
        </h1>
        <div className="flex items-center gap-2">
          <DataTableExport
            visibleRows={data?.logs ?? []}
            columns={EXPORT_COLUMNS}
            fileName="communication-logs"
            exportAllUrl={(() => {
              const qParams = new URLSearchParams();
              if (channelFilter !== "all") qParams.set("channel", channelFilter);
              if (directionFilter !== "all") qParams.set("direction", directionFilter);
              if (debouncedSearch) qParams.set("search", debouncedSearch);
              const qs = qParams.toString();
              return `${API_BASE_URL}/api/v1/export/communication_logs${qs ? `?${qs}` : ""}`;
            })()}
          />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Log Communication
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by subject or contact..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="video_call">Video Call</SelectItem>
            <SelectItem value="in_person">In Person</SelectItem>
            <SelectItem value="letter">Letter</SelectItem>
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Logged By</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(log.occurred_at).toLocaleDateString()}{" "}
                    <span className="text-muted-foreground">
                      {new Date(log.occurred_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={CHANNEL_VARIANT[log.channel] ?? "outline"}>
                      {CHANNEL_LABELS[log.channel] ?? log.channel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={DIRECTION_VARIANT[log.direction] ?? "outline"}
                    >
                      {log.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate font-medium">
                    {log.subject}
                  </TableCell>
                  <TableCell>
                    {log.contact_name || log.client_name || log.partner_name || "—"}
                  </TableCell>
                  <TableCell>{log.logger_name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(log)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(log.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data?.logs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No communication logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total} log{data.total !== 1 ? "s" : ""} total
        </p>
      )}

      <CommunicationLogForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingLog(null);
        }}
        onSubmit={editingLog ? handleUpdate : handleCreate}
        isLoading={createMutation.isPending || updateMutation.isPending}
        initialData={editingLog}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Communication Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this communication log entry? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

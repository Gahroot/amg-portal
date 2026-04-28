"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { listUsers, updateUser } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS } from "@/lib/constants";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import type { User, UserUpdateData } from "@/types/user";

const EXPORT_COLUMNS: ExportColumn<User>[] = [
  { header: "Full Name", accessor: "full_name" },
  { header: "Email", accessor: "email" },
  { header: "Role", accessor: (r) => ROLE_LABELS[r.role] ?? r.role },
  { header: "Status", accessor: "status" },
  { header: "MFA Enabled", accessor: (r) => (r.mfa_enabled ? "Yes" : "No") },
  { header: "Created", accessor: (r) => new Date(r.created_at).toLocaleDateString() },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "destructive",
  pending_approval: "outline",
};

const ALL_ROLES: Array<{ value: string; label: string }> = [
  { value: "managing_director", label: "Managing Director" },
  { value: "relationship_manager", label: "Relationship Manager" },
  { value: "coordinator", label: "Coordinator" },
  { value: "finance_compliance", label: "Finance & Compliance" },
  { value: "client", label: "Client" },
  { value: "partner", label: "Partner" },
];

const ALL_STATUSES: Array<{ value: string; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending_approval", label: "Pending Approval" },
];

// ─── Edit User Sheet ──────────────────────────────────────────────────────────

interface EditUserSheetProps {
  user: User | null;
  onClose: () => void;
  onSave: (id: string, data: UserUpdateData) => Promise<void>;
  isPending: boolean;
}

function EditUserSheet({ user, onClose, onSave, isPending }: EditUserSheetProps) {
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [role, setRole] = useState(user?.role ?? "");
  const [status, setStatus] = useState(user?.status ?? "active");

  // Sync form with selected user
  if (user && fullName !== user.full_name && role !== user.role && status !== user.status) {
    setFullName(user.full_name);
    setRole(user.role);
    setStatus(user.status);
  }

  const handleOpen = (open: boolean) => {
    if (!open) onClose();
  };

  const handleSave = async () => {
    if (!user) return;
    await onSave(user.id, {
      full_name: fullName || undefined,
      role: role as UserUpdateData["role"] || undefined,
      status: status || undefined,
    });
  };

  return (
    <Sheet open={user !== null} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit User</SheetTitle>
          <SheetDescription>{user?.email}</SheetDescription>
        </SheetHeader>

        {user && (
          <div className="mt-6 space-y-6">
            {/* MFA status (read-only display) */}
            <div className="flex items-center gap-3 rounded-md border p-3">
              {user.mfa_enabled ? (
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              ) : (
                <ShieldOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">
                  MFA {user.mfa_enabled ? "Enabled" : "Disabled"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.mfa_enabled
                    ? "Two-factor authentication is active."
                    : "User has not set up two-factor authentication."}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Last login</p>
              <p className="text-sm">
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleString()
                  : "Never"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Account created</p>
              <p className="text-sm">
                {new Date(user.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
    enabled: user?.role === "managing_director",
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdateData }) =>
      updateUser(id, data),
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
    },
    onError: () => toast.error("Failed to update user"),
  });

  if (user?.role !== "managing_director") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            User Management
          </h1>
          <div className="flex items-center gap-2">
            <DataTableExport
              visibleRows={data?.users ?? []}
              columns={EXPORT_COLUMNS}
              fileName="users"
            />
            <Button asChild>
              <Link href="/users/new">Add User</Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading users...</p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer"
                    onClick={() => setEditingUser(u)}
                  >
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[u.status] ?? "outline"}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.mfa_enabled ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" aria-label="MFA enabled" />
                      ) : (
                        <ShieldOff className="h-4 w-4 text-muted-foreground/40" aria-label="MFA disabled" />
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingUser(u)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit user</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.users.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} user{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>

      <EditUserSheet
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSave={async (id, data) => {
          await updateMutation.mutateAsync({ id, data });
        }}
        isPending={updateMutation.isPending}
      />
    </div>
  );
}

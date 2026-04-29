"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getWorkloadOverview, getStaffAssignments } from "@/lib/api/workload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const ALLOWED_ROLES = [
  "managing_director",
  "relationship_manager",
  "coordinator",
];

const CAPACITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  available: "default",
  at_capacity: "secondary",
  overloaded: "destructive",
};

import { ROLE_LABELS } from "@/lib/constants";

export default function WorkloadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(
    null,
  );
  const [capacityFilter, setCapacityFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["workload"],
    queryFn: () => getWorkloadOverview(),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const { data: staffAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["workload", selectedStaffId, "assignments"],
    queryFn: () => getStaffAssignments(selectedStaffId!),
    enabled: !!selectedStaffId,
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const filteredStaff =
    data?.staff.filter((s) => {
      if (capacityFilter === "all") return true;
      return s.capacity_status === capacityFilter;
    }) ?? [];

  const selectedStaff = data?.staff.find((s) => s.user_id === selectedStaffId);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-full space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Staff Workload
          </h1>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Staff</p>
                    <p className="text-2xl font-bold">
                      {data.summary.total_staff}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold">
                      {data.summary.available_staff}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">At Capacity</p>
                    <p className="text-2xl font-bold">
                      {data.summary.at_capacity_staff}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Open Escalations
                    </p>
                    <p className="text-2xl font-bold">
                      {data.summary.total_open_escalations}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select
            value={capacityFilter}
            onValueChange={setCapacityFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Capacity Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="at_capacity">At Capacity</SelectItem>
              <SelectItem value="overloaded">Overloaded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading workload...</p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active Programs</TableHead>
                  <TableHead>Pending Tasks</TableHead>
                  <TableHead>Open Escalations</TableHead>
                  <TableHead>Workload</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((staff) => (
                  <TableRow key={staff.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{staff.user_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {staff.user_email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ROLE_LABELS[staff.role] ?? staff.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{staff.active_programs}</TableCell>
                    <TableCell>{staff.pending_tasks}</TableCell>
                    <TableCell>
                      {staff.open_escalations > 0 ? (
                        <Badge variant="destructive">
                          {staff.open_escalations}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(staff.workload_score, 100)}
                          className="w-20"
                        />
                        <span className="text-sm">{staff.workload_score}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={CAPACITY_VARIANT[staff.capacity_status]}>
                        {staff.capacity_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStaffId(staff.user_id)}
                      >
                        View Assignments
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredStaff.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      No staff members found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Staff Assignments Dialog */}
        <Dialog
          open={!!selectedStaffId}
          onOpenChange={(open) => !open && setSelectedStaffId(null)}
        >
          <DialogContent className="max-w-7xl">
            <DialogHeader>
              <DialogTitle>
                Assignments - {selectedStaff?.user_name || "Staff Member"}
              </DialogTitle>
            </DialogHeader>
            {assignmentsLoading ? (
              <p className="text-muted-foreground text-sm">
                Loading assignments...
              </p>
            ) : staffAssignments?.assignments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No active assignments.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Escalations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffAssignments?.assignments.map((assignment) => (
                      <TableRow
                        key={assignment.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/programs/${assignment.program_id}`)
                        }
                      >
                        <TableCell className="font-medium">
                          {assignment.program_title}
                        </TableCell>
                        <TableCell>{assignment.client_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{assignment.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{assignment.program_status}</Badge>
                        </TableCell>
                        <TableCell>
                          {assignment.active_escalations > 0 ? (
                            <Badge variant="destructive">
                              {assignment.active_escalations}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

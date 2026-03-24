"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePartnerAssignments } from "@/hooks/use-partner-portal";
import { acceptAssignment } from "@/lib/api/assignments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, FileText, Search } from "lucide-react";
import type { Assignment } from "@/lib/api/assignments";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", dispatched: "secondary", accepted: "default",
  in_progress: "default", completed: "default", cancelled: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", dispatched: "New", accepted: "Accepted",
  in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
};

function filterAssignments(assignments: Assignment[], search: string) {
  if (!assignments) return [];
  if (!search) return assignments;
  const searchLower = search.toLowerCase();
  return assignments.filter((a) =>
    a.title.toLowerCase().includes(searchLower) ||
    a.program_title?.toLowerCase().includes(searchLower) ||
    a.brief.toLowerCase().includes(searchLower)
  );
}

function groupAssignments(assignments: Assignment[]) {
  return {
    newItems: assignments.filter((a) => a.status === "dispatched"),
    activeItems: assignments.filter((a) => a.status === "accepted" || a.status === "in_progress"),
    completedItems: assignments.filter((a) => a.status === "completed"),
  };
}

function getDueDateDisplay(dateStr: string | null) {
  if (!dateStr) return { text: "-", color: "text-muted-foreground" };
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "Overdue by " + Math.abs(diffDays) + " days", color: "text-destructive font-medium" };
  if (diffDays === 0) return { text: "Due today", color: "text-orange-600 font-medium" };
  if (diffDays === 1) return { text: "Due tomorrow", color: "text-orange-600 font-medium" };
  if (diffDays <= 7) return { text: "Due in " + diffDays + " days", color: "text-yellow-600 font-medium" };
  return { text: date.toLocaleDateString(), color: "text-muted-foreground" };
}

function AssignmentTable({ items, onAccept, isAccepting }: { items: Assignment[]; onAccept: (id: string) => void; isAccepting: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Assignment</TableHead>
          <TableHead>Program</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((assignment) => {
          const dueDate = getDueDateDisplay(assignment.due_date);
          return (
            <TableRow key={assignment.id}>
              <TableCell>
                <div className="space-y-1">
                  <Link href={"/partner/inbox/" + assignment.id} className="font-medium hover:underline">{assignment.title}</Link>
                  <p className="text-xs text-muted-foreground line-clamp-1">{assignment.brief.slice(0, 80)}...</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {assignment.program_title ?? "-"}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[assignment.status] ?? "outline"}>{STATUS_LABELS[assignment.status] ?? assignment.status}</Badge>
              </TableCell>
              <TableCell>
                <div className={"flex items-center gap-1 " + dueDate.color}>
                  {assignment.due_date && <Clock className="h-3 w-3" />}
                  {dueDate.text}
                </div>
              </TableCell>
              <TableCell>
                {assignment.status === "dispatched" && (
                  <Button size="sm" onClick={() => onAccept(assignment.id)} disabled={isAccepting}>
                    {isAccepting ? "Accepting..." : "Accept"}
                  </Button>
                )}
                {assignment.status !== "dispatched" && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={"/partner/inbox/" + assignment.id}>View Details</Link>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No assignments found.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default function PartnerInboxPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [error, setError] = React.useState<string | null>(null);

  const { data, isLoading } = usePartnerAssignments(statusFilter !== "all" ? { status: statusFilter } : undefined);

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-portal", "assignments"] });
    },
    onError: () => {
      setError("Failed to accept assignment.");
    },
  });

  const filtered = filterAssignments(data?.assignments || [], search);
  const grouped = groupAssignments(filtered);

  if (isLoading) {
    return <div className="mx-auto max-w-5xl"><p className="text-muted-foreground text-sm">Loading inbox...</p></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Assignment Inbox</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search assignments..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="dispatched">New</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">New</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{grouped.newItems.length}</p><p className="text-xs text-muted-foreground">Awaiting your response</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{grouped.activeItems.length}</p><p className="text-xs text-muted-foreground">In progress</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{grouped.completedItems.length}</p><p className="text-xs text-muted-foreground">Finished</p></CardContent></Card>
      </div>

      <Tabs defaultValue="new" className="space-y-4">
        <TabsList>
          <TabsTrigger value="new" className="relative">New{grouped.newItems.length > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{grouped.newItems.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="active">Active ({grouped.activeItems.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({grouped.completedItems.length})</TabsTrigger>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="new"><div className="rounded-md border bg-white"><AssignmentTable items={grouped.newItems} onAccept={(id) => acceptMutation.mutate(id)} isAccepting={acceptMutation.isPending} /></div></TabsContent>
        <TabsContent value="active"><div className="rounded-md border bg-white"><AssignmentTable items={grouped.activeItems} onAccept={(id) => acceptMutation.mutate(id)} isAccepting={acceptMutation.isPending} /></div></TabsContent>
        <TabsContent value="completed"><div className="rounded-md border bg-white"><AssignmentTable items={grouped.completedItems} onAccept={(id) => acceptMutation.mutate(id)} isAccepting={acceptMutation.isPending} /></div></TabsContent>
        <TabsContent value="all"><div className="rounded-md border bg-white"><AssignmentTable items={filtered} onAccept={(id) => acceptMutation.mutate(id)} isAccepting={acceptMutation.isPending} /></div></TabsContent>
      </Tabs>

      {data && <p className="text-sm text-muted-foreground">{data.total} assignment{data.total !== 1 ? "s" : ""} total</p>}
    </div>
  );
}

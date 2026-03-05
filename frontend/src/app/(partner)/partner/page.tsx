"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getMyProfile,
  getMyAssignments,
  getMyDeliverables,
} from "@/lib/api/partner-portal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ASSIGNMENT_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  dispatched: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

export default function PartnerDashboardPage() {
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["partner-portal", "profile"],
    queryFn: () => getMyProfile(),
  });

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["partner-portal", "assignments"],
    queryFn: () => getMyAssignments(),
  });

  const { data: deliverablesData, isLoading: deliverablesLoading } = useQuery({
    queryKey: ["partner-portal", "deliverables"],
    queryFn: () => getMyDeliverables(),
  });

  const isLoading = profileLoading || assignmentsLoading || deliverablesLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  const activeAssignments =
    assignmentsData?.assignments.filter(
      (a) =>
        a.status === "accepted" ||
        a.status === "in_progress" ||
        a.status === "dispatched"
    ).length ?? 0;

  const pendingDeliverables =
    deliverablesData?.deliverables.filter(
      (d) => d.status === "pending" || d.status === "returned"
    ).length ?? 0;

  const completedAssignments =
    assignmentsData?.assignments.filter((a) => a.status === "completed")
      .length ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Welcome, {profile?.firm_name ?? "Partner"}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Active Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{activeAssignments}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Pending Deliverables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingDeliverables}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{completedAssignments}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Recent Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignmentsData?.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assignments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {assignmentsData?.assignments.slice(0, 5).map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/partner/assignments/${assignment.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{assignment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.program_title ?? "No program"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignment.due_date && (
                      <span className="text-xs text-muted-foreground">
                        Due{" "}
                        {new Date(
                          assignment.due_date
                        ).toLocaleDateString()}
                      </span>
                    )}
                    <Badge
                      variant={
                        ASSIGNMENT_STATUS_VARIANT[assignment.status] ??
                        "outline"
                      }
                    >
                      {assignment.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

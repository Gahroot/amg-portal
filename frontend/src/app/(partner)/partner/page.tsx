"use client";

import * as React from "react";
import Link from "next/link";
import {
  usePartnerProfile,
  usePartnerAssignments,
  usePartnerDeliverables,
  usePartnerConversations,
} from "@/hooks/use-partner-portal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  PackageCheck,
  MessageSquare,
  FileText,
  ArrowRight,
  Clock,
  AlertCircle,
} from "lucide-react";

export default function PartnerDashboardPage() {
  const { data: profile, isLoading: profileLoading } = usePartnerProfile();
  const { data: assignmentsData, isLoading: assignmentsLoading } = usePartnerAssignments();
  const { data: deliverablesData, isLoading: deliverablesLoading } = usePartnerDeliverables();
  const { data: conversationsData, isLoading: conversationsLoading } = usePartnerConversations();

  const isLoading = profileLoading || assignmentsLoading || deliverablesLoading || conversationsLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  const newAssignments = assignmentsData?.assignments.filter((a) => a.status === "dispatched").length ?? 0;
  const activeAssignments =
    assignmentsData?.assignments.filter(
      (a) => a.status === "accepted" || a.status === "in_progress"
    ).length ?? 0;

  const pendingDeliverables =
    deliverablesData?.deliverables.filter(
      (d) => d.status === "pending" || d.status === "returned"
    ).length ?? 0;

  const completedAssignments =
    assignmentsData?.assignments.filter((a) => a.status === "completed").length ?? 0;

  const totalUnread = conversationsData?.conversations.reduce((sum, c) => sum + c.unread_count, 0) ?? 0;

  const recentNewAssignments = assignmentsData?.assignments
    .filter((a) => a.status === "dispatched")
    .slice(0, 3) ?? [];

  const urgentDeliverables = deliverablesData?.deliverables
    .filter((d) => d.status === "pending" || d.status === "returned")
    .slice(0, 3) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Welcome, {profile?.firm_name ?? "Partner"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your assignments, deliverables, and communications
          </p>
        </div>
        {newAssignments > 0 && (
          <Badge variant="destructive" className="text-sm py-1 px-3">
            {newAssignments} new assignment{newAssignments !== 1 ? "s" : ""} awaiting response
          </Badge>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/partner/inbox">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New</p>
                  <p className="text-2xl font-bold">{newAssignments}</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/partner/inbox">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{activeAssignments}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/partner/deliverables">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingDeliverables}</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <PackageCheck className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/partner/messages">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Messages</p>
                  <p className="text-2xl font-bold">{totalUnread}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Action Required Section */}
      {(newAssignments > 0 || pendingDeliverables > 0) && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {newAssignments > 0 && (
              <div className="flex items-center justify-between p-3 bg-white rounded-md border">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium">{newAssignments} new assignment{newAssignments !== 1 ? "s" : ""}</p>
                    <p className="text-sm text-muted-foreground">Awaiting your acceptance</p>
                  </div>
                </div>
                <Button asChild size="sm">
                  <Link href="/partner/inbox">
                    View Inbox <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
            {pendingDeliverables > 0 && (
              <div className="flex items-center justify-between p-3 bg-white rounded-md border">
                <div className="flex items-center gap-3">
                  <PackageCheck className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium">{pendingDeliverables} pending deliverable{pendingDeliverables !== 1 ? "s" : ""}</p>
                    <p className="text-sm text-muted-foreground">Need to be uploaded</p>
                  </div>
                </div>
                <Button asChild size="sm">
                  <Link href="/partner/deliverables">
                    View Deliverables <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent New Assignments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">New Assignments</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/partner/inbox">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentNewAssignments.length === 0 ? (
              <div className="text-center py-6">
                <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No new assignments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentNewAssignments.map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/partner/inbox/${assignment.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.program_title ?? "No program"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {assignment.due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <Badge variant="secondary">New</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Urgent Deliverables */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Pending Deliverables</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/partner/deliverables">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {urgentDeliverables.length === 0 ? (
              <div className="text-center py-6">
                <PackageCheck className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No pending deliverables</p>
              </div>
            ) : (
              <div className="space-y-3">
                {urgentDeliverables.map((deliverable) => (
                  <Link
                    key={deliverable.id}
                    href={`/partner/deliverables/${deliverable.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{deliverable.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {deliverable.deliverable_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {deliverable.due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due {new Date(deliverable.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <Badge variant={deliverable.status === "returned" ? "destructive" : "outline"}>
                        {deliverable.status === "returned" ? "Returned" : "Pending"}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/partner/inbox">
                <ClipboardList className="h-5 w-5" />
                <span>Assignment Inbox</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/partner/deliverables">
                <PackageCheck className="h-5 w-5" />
                <span>Deliverables</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/partner/messages">
                <MessageSquare className="h-5 w-5" />
                <span>Messages</span>
                {totalUnread > 0 && (
                  <Badge variant="destructive" className="text-xs">{totalUnread}</Badge>
                )}
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/partner/documents">
                <FileText className="h-5 w-5" />
                <span>Documents</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Completed Summary */}
      {completedAssignments > 0 && (
        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ClipboardList className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">{completedAssignments} completed assignment{completedAssignments !== 1 ? "s" : ""}</p>
              <p className="text-sm text-muted-foreground">Great work on completing your assignments!</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/partner/inbox">View History</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

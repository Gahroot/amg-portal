"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getRMPortfolioReport } from "@/lib/api/reports";
import { listUsers } from "@/lib/api/users";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { Users, Briefcase, TrendingUp, Star } from "lucide-react";

const ALLOWED_ROLES = ["managing_director", "relationship_manager"];

const RAG_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  green: "default",
  amber: "secondary",
  red: "destructive",
};

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function RMPortfolioReportPage() {
  const { user } = useAuth();
  const isMD = user?.role === "managing_director";

  const [selectedRmId, setSelectedRmId] = useState<string | undefined>(undefined);

  // MDs can pick any RM; RMs are locked to themselves
  const { data: usersData } = useQuery({
    queryKey: ["users", { role: "relationship_manager" }],
    queryFn: () => listUsers({ role: "relationship_manager" }),
    enabled: isMD,
  });

  const rmId = isMD ? selectedRmId : user?.id;

  const { data: report, isLoading } = useQuery({
    queryKey: ["rm-portfolio-report", rmId],
    queryFn: () => getRMPortfolioReport(rmId),
    enabled: !!user && ALLOWED_ROLES.includes(user.role) && (isMD ? !!rmId : true),
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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              RM Portfolio Report
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Client portfolio, program health, and revenue pipeline by relationship manager
            </p>
          </div>

          {/* MD RM selector */}
          {isMD && (
            <Select
              value={selectedRmId ?? ""}
              onValueChange={(v) => setSelectedRmId(v || undefined)}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select Relationship Manager" />
              </SelectTrigger>
              <SelectContent>
                {usersData?.users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading portfolio data...</p>
        )}

        {!isLoading && !report && isMD && !selectedRmId && (
          <p className="text-sm text-muted-foreground">
            Select a relationship manager to view their portfolio.
          </p>
        )}

        {report && (
          <>
            {/* RM identity */}
            <div className="rounded-md border bg-card px-5 py-4">
              <p className="font-semibold">{report.rm_name}</p>
              <p className="text-sm text-muted-foreground">{report.rm_email}</p>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Clients
                  </CardTitle>
                  <Users className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{report.total_clients}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Programs
                  </CardTitle>
                  <Briefcase className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{report.total_active_programs}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenue Pipeline
                  </CardTitle>
                  <TrendingUp className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(report.total_revenue_pipeline)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg NPS Score
                  </CardTitle>
                  <Star className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {report.avg_nps_score !== null ? report.avg_nps_score.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">out of 10</p>
                </CardContent>
              </Card>
            </div>

            {/* Client table */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Client Portfolio</h2>
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Programs</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>RAG</TableHead>
                      <TableHead>Milestone Rate</TableHead>
                      <TableHead>Pipeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.clients.map((client) => {
                      const ragCounts = client.rag_summary;
                      const dominantRag =
                        (ragCounts["red"] ?? 0) > 0
                          ? "red"
                          : (ragCounts["amber"] ?? 0) > 0
                            ? "amber"
                            : "green";

                      return (
                        <TableRow key={client.client_id}>
                          <TableCell className="font-medium">
                            {client.client_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {client.client_type.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                client.client_status === "active" ? "default" : "secondary"
                              }
                              className="capitalize text-xs"
                            >
                              {client.client_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{client.total_programs}</TableCell>
                          <TableCell>{client.active_programs}</TableCell>
                          <TableCell>
                            <Badge variant={RAG_BADGE[dominantRag]} className="uppercase text-xs">
                              {dominantRag}
                            </Badge>
                          </TableCell>
                          <TableCell className="w-40">
                            {client.milestone_completion_rate !== null ? (
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={client.milestone_completion_rate}
                                  className="h-2 flex-1"
                                />
                                <span className="text-xs text-muted-foreground w-9">
                                  {client.milestone_completion_rate}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatCurrency(client.revenue_pipeline)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {report.clients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No clients found for this relationship manager.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Program detail per client */}
            {report.clients
              .filter((c) => c.programs.length > 0)
              .map((client) => (
                <div key={client.client_id} className="space-y-2">
                  <h3 className="text-base font-semibold text-muted-foreground">
                    {client.client_name} — Programs
                  </h3>
                  <div className="rounded-md border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Program</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>RAG</TableHead>
                          <TableHead>Milestones</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Budget</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {client.programs.map((prog) => (
                          <TableRow key={prog.id}>
                            <TableCell className="font-medium">{prog.title}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize text-xs">
                                {prog.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={RAG_BADGE[prog.rag_status]}
                                className="uppercase text-xs"
                              >
                                {prog.rag_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {prog.completed_milestone_count}/{prog.milestone_count}
                            </TableCell>
                            <TableCell className="w-32">
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={prog.milestone_progress}
                                  className="h-2 flex-1"
                                />
                                <span className="text-xs text-muted-foreground w-9">
                                  {prog.milestone_progress}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatCurrency(prog.budget_envelope)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}

            <p className="text-xs text-muted-foreground">
              Generated {new Date(report.generated_at).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

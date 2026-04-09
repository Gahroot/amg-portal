"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { usePartnerRankings, usePartnerScorecard } from "@/hooks/use-dashboard";
import { PartnerScorecardCard } from "@/components/dashboard/partner-scorecard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

export default function PartnerPerformancePage() {
  const { user } = useAuth();
  const [selectedPartnerId, setSelectedPartnerId] = useState<
    string | null
  >(null);
  const { data: rankings, isLoading } = usePartnerRankings();
  const { data: scorecard } = usePartnerScorecard(selectedPartnerId ?? "");

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
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Partner Performance
          </h1>
          <Link href="/analytics">
            <Button variant="outline">Back to Analytics</Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Rankings Table */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 font-serif text-xl font-semibold">
              Partner Rankings
            </h2>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading rankings...
              </p>
            ) : rankings && rankings.rankings.length > 0 ? (
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Firm</TableHead>
                      <TableHead className="text-right">
                        Avg Score
                      </TableHead>
                      <TableHead className="text-right">Ratings</TableHead>
                      <TableHead className="text-right">
                        Assignments
                      </TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.rankings.map((r, idx) => (
                      <TableRow
                        key={r.partner_id}
                        className={
                          selectedPartnerId === r.partner_id
                            ? "bg-muted/50"
                            : "cursor-pointer"
                        }
                        onClick={() => setSelectedPartnerId(r.partner_id)}
                      >
                        <TableCell className="text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.firm_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.avg_overall !== null ? (
                            <Badge
                              variant={
                                r.avg_overall >= 4.0
                                  ? "default"
                                  : r.avg_overall >= 3.0
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {r.avg_overall.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              --
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.total_ratings}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.total_assignments}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPartnerId(r.partner_id);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No partner rankings available.
              </p>
            )}
          </div>

          {/* Scorecard Detail Panel */}
          <div>
            <h2 className="mb-4 font-serif text-xl font-semibold">
              Scorecard
            </h2>
            {selectedPartnerId && scorecard ? (
              <PartnerScorecardCard scorecard={scorecard} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Select a partner to view their scorecard.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

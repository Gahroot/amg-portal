"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useClientProfiles } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

export default function ComplianceQueuePage() {
  const { user } = useAuth();

  const { data, isLoading } = useClientProfiles({
    compliance_status: "pending_review",
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
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Compliance Queue
        </h1>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.legal_name}
                    </TableCell>
                    <TableCell>{profile.entity_type ?? "-"}</TableCell>
                    <TableCell>{profile.jurisdiction ?? "-"}</TableCell>
                    <TableCell>
                      {new Date(profile.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm">
                        <Link href={`/compliance/${profile.id}`}>Review</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.profiles.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No profiles pending compliance review.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} profile{data.total !== 1 ? "s" : ""} pending review
          </p>
        )}
      </div>
    </div>
  );
}

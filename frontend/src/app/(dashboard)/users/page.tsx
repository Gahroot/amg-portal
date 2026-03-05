"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listUsers } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  relationship_manager: "Relationship Manager",
  coordinator: "Coordinator",
  finance_compliance: "Finance & Compliance",
  client: "Client",
  partner: "Partner",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "destructive",
  pending_approval: "outline",
};

export default function UsersPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
    enabled: user?.role === "managing_director",
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
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            User Management
          </h1>
          <Button asChild>
            <Link href="/users/new">Add User</Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading users...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
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
                  </TableRow>
                ))}
                {data?.users.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
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
    </div>
  );
}

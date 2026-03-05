"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listPartners } from "@/lib/api/partners";
import type { PartnerListParams } from "@/lib/api/partners";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const INTERNAL_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
  draft: "outline",
};

const AVAILABILITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  available: "default",
  busy: "secondary",
  unavailable: "destructive",
};

export default function PartnersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filters, setFilters] = React.useState<PartnerListParams>({});

  const { data, isLoading } = useQuery({
    queryKey: ["partners", filters],
    queryFn: () => listPartners(filters),
    enabled: !!user && INTERNAL_ROLES.includes(user.role),
  });

  if (!user || !INTERNAL_ROLES.includes(user.role)) {
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
            Partner Directory
          </h1>
          <Button asChild>
            <Link href="/partners/new">New Partner</Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="Search partners..."
            className="max-w-xs"
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value || undefined }))
            }
          />
          <Select
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                status: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                availability: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading partners...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firm Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Capabilities</TableHead>
                  <TableHead>Geographies</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.profiles.map((partner) => (
                  <TableRow
                    key={partner.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/partners/${partner.id}`)}
                  >
                    <TableCell className="font-medium">
                      {partner.firm_name}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{partner.contact_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {partner.contact_email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {partner.capabilities.slice(0, 3).map((cap) => (
                          <Badge key={cap} variant="secondary">
                            {cap}
                          </Badge>
                        ))}
                        {partner.capabilities.length > 3 && (
                          <Badge variant="outline">
                            +{partner.capabilities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {partner.geographies.slice(0, 2).map((geo) => (
                          <Badge key={geo} variant="outline">
                            {geo}
                          </Badge>
                        ))}
                        {partner.geographies.length > 2 && (
                          <Badge variant="outline">
                            +{partner.geographies.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          AVAILABILITY_VARIANT[partner.availability_status] ??
                          "outline"
                        }
                      >
                        {partner.availability_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {partner.performance_rating != null
                        ? partner.performance_rating.toFixed(1)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          STATUS_VARIANT[partner.status] ?? "outline"
                        }
                      >
                        {partner.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.profiles.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No partners found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} partner{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { comparePartners, listPartners } from "@/lib/api/partners";
import type { PartnerProfile } from "@/types/partner";
import { useAuth } from "@/providers/auth-provider";
import { PartnerComparison } from "@/components/partners/partner-comparison";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, CheckIcon, ChevronsUpDown, XIcon } from "lucide-react";
import Link from "next/link";
import { TableSkeleton } from "@/components/ui/loading-skeletons";

const INTERNAL_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

// ── Partner selector chip ──────────────────────────────────────────────────────

interface PartnerChipProps {
  partner: PartnerProfile;
  onRemove: () => void;
}

function PartnerChip({ partner, onRemove }: PartnerChipProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm shadow-sm">
      <span className="font-medium">{partner.firm_name}</span>
      <span className="text-muted-foreground">·</span>
      <Badge
        variant={
          partner.availability_status === "available"
            ? "default"
            : partner.availability_status === "busy"
              ? "secondary"
              : "destructive"
        }
        className="text-xs py-0"
      >
        {partner.availability_status}
      </Badge>
      <button
        onClick={onRemove}
        className="ml-1 text-muted-foreground hover:text-destructive"
        title="Remove"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main page content ──────────────────────────────────────────────────────────

function ComparePageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // IDs from URL query param ?ids=id1,id2,...
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const raw = searchParams.get("ids");
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState("");

  // Keep URL in sync with selectedIds
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedIds.length > 0) {
      params.set("ids", selectedIds.join(","));
    } else {
      params.delete("ids");
    }
    router.replace(`/partners/compare?${params.toString()}`, { scroll: false });
  }, [selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch all partners for the selector
  const { data: allPartnersData } = useQuery({
    queryKey: ["partners", "all-for-compare"],
    queryFn: () => listPartners({ limit: 100, status: "active" }),
    enabled: !!user && INTERNAL_ROLES.includes(user.role),
  });

  const allPartners = useMemo(() => allPartnersData?.profiles ?? [], [allPartnersData]);

  // Map for quick lookup
  const partnerMap = useMemo(() => {
    const m = new Map<string, PartnerProfile>();
    allPartners.forEach((p) => m.set(p.id, p));
    return m;
  }, [allPartners]);

  const selectedPartners = selectedIds
    .map((id) => partnerMap.get(id))
    .filter((p): p is PartnerProfile => Boolean(p));

  // Fetch comparison data when we have 2+ IDs
  const canCompare = selectedIds.length >= 2;
  const { data: comparisonData, isLoading: isComparing } = useQuery({
    queryKey: ["partners", "compare", selectedIds],
    queryFn: () => comparePartners(selectedIds),
    enabled: canCompare,
  });

  function handleAdd(partnerId: string) {
    if (selectedIds.includes(partnerId)) return;
    if (selectedIds.length >= 4) return;
    setSelectedIds((prev) => [...prev, partnerId]);
    setSelectorOpen(false);
  }

  function handleRemove(partnerId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== partnerId));
  }

  if (!user || !INTERNAL_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const availableToAdd = allPartners.filter((p) => !selectedIds.includes(p.id));

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/partners">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Partner Comparison
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select 2–4 partners to compare side-by-side
            </p>
          </div>
        </div>

        {/* Selection bar */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {selectedPartners.map((p) => (
              <PartnerChip
                key={p.id}
                partner={p}
                onRemove={() => handleRemove(p.id)}
              />
            ))}

            {selectedIds.length < 4 && (
              <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8"
                    role="combobox"
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    Add partner
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search partners…"
                      value={selectorSearch}
                      onValueChange={setSelectorSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No partners found.</CommandEmpty>
                      <CommandGroup>
                        {availableToAdd
                          .filter(
                            (p) =>
                              selectorSearch === "" ||
                              p.firm_name
                                .toLowerCase()
                                .includes(selectorSearch.toLowerCase())
                          )
                          .slice(0, 20)
                          .map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.firm_name}
                              onSelect={() => handleAdd(p.id)}
                            >
                              <div className="flex flex-col">
                                <span>{p.firm_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {p.contact_name}
                                </span>
                              </div>
                              {selectedIds.includes(p.id) && (
                                <CheckIcon className="ml-auto h-4 w-4" />
                              )}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {selectedIds.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No partners selected yet. Add at least 2 to compare.
              </span>
            )}

            {selectedIds.length === 1 && (
              <span className="text-sm text-muted-foreground">
                Add at least 1 more partner to compare.
              </span>
            )}

            {selectedIds.length >= 2 && (
              <Badge variant="secondary" className="ml-auto">
                {selectedIds.length} selected
              </Badge>
            )}
          </div>
        </div>

        {/* Comparison results */}
        {!canCompare && (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
            <p>Select at least 2 partners above to start comparing.</p>
          </div>
        )}

        {canCompare && isComparing && (
          <TableSkeleton rows={3} columns={4} />
        )}

        {canCompare && !isComparing && comparisonData && (
          <PartnerComparison
            partners={comparisonData.partners}
            onRemove={handleRemove}
          />
        )}
      </div>
    </div>
  );
}

export default function ComparePartnersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-8">
          <div className="mx-auto max-w-7xl">
            <TableSkeleton rows={3} columns={4} />
          </div>
        </div>
      }
    >
      <ComparePageContent />
    </Suspense>
  );
}

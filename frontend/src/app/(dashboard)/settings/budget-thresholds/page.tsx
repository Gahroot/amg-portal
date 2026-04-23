"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  useApprovalThresholds,
  useApprovalChains,
  useDeleteApprovalChain,
} from "@/hooks/use-budget-approvals";
import type { ApprovalChainSummary } from "@/types/budget-approval";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Settings, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { BudgetThresholdList } from "./_components/budget-threshold-list";
import { ChainDetail } from "./_components/approval-chain-builder";
import { ChainDialog } from "./_components/approval-chain-dialog";

const ALLOWED_ROLES = ["managing_director"];

export default function BudgetThresholdsPage() {
  const { user } = useAuth();

  const { data: thresholds = [], isLoading: thresholdsLoading } =
    useApprovalThresholds();
  const { data: chains = [], isLoading: chainsLoading } = useApprovalChains();

  const deleteChain = useDeleteApprovalChain();

  const [chainDialogOpen, setChainDialogOpen] = useState(false);
  const [editingChain, setEditingChain] =
    useState<ApprovalChainSummary | null>(null);
  const [deleteChainId, setDeleteChainId] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(
    null
  );

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
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Settings className="mt-1 h-7 w-7 text-muted-foreground shrink-0" />
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Budget Approval Configuration
            </h1>
            <p className="mt-1 text-muted-foreground">
              Configure approval thresholds and multi-step approval chains that
              govern program budget requests.
            </p>
          </div>
        </div>

        {/* Reference Card */}
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              Governance Reference — Program Approval Tiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  tier: "Standard",
                  rule: "Below defined threshold",
                  approver: "Relationship Manager sign-off",
                },
                {
                  tier: "Elevated",
                  rule: "Above threshold",
                  approver: "RM + MD joint sign-off; MD review within 24h",
                },
                {
                  tier: "Strategic",
                  rule: "Complex / high-value",
                  approver: "Full Leadership Review — formal decision record",
                },
                {
                  tier: "Emergency",
                  rule: "Urgent activation",
                  approver: "MD verbal + retrospective formal within 4h",
                },
              ].map((row) => (
                <div
                  key={row.tier}
                  className="rounded-md border border-amber-200 dark:border-amber-800 bg-card/80 p-3"
                >
                  <p className="font-semibold text-amber-900 dark:text-amber-300 text-sm">
                    {row.tier}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {row.rule}
                  </p>
                  <p className="text-xs mt-1 text-amber-800 dark:text-amber-300">{row.approver}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <BudgetThresholdList
          thresholds={thresholds}
          isLoading={thresholdsLoading}
          chains={chains}
        />

        <Separator />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Approval Chains</CardTitle>
                <CardDescription>
                  Define multi-step approval workflows with ordered approver
                  roles. Click a chain to configure its steps.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEditingChain(null);
                  setChainDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                New Chain
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedChainId ? (
              <ChainDetail
                chainId={selectedChainId}
                onBack={() => setSelectedChainId(null)}
              />
            ) : chainsLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading chains…
              </p>
            ) : (
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chain Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chains.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedChainId(c.id)}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1">
                            {c.name}
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {c.step_count}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.is_active ? "default" : "secondary"}
                          >
                            {c.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingChain(c);
                                setChainDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteChainId(c.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {chains.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No approval chains defined. Create one and add steps
                          to build an approval workflow.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ChainDialog
        open={chainDialogOpen}
        onOpenChange={setChainDialogOpen}
        chain={editingChain}
      />

      {/* Delete Chain Confirmation */}
      <AlertDialog
        open={!!deleteChainId}
        onOpenChange={(o) => !o && setDeleteChainId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Approval Chain?</AlertDialogTitle>
            <AlertDialogDescription>
              This chain and all its steps will be permanently deleted. Existing
              approval requests that reference it will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteChainId) {
                  deleteChain.mutate(deleteChainId, {
                    onSuccess: () => setDeleteChainId(null),
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useDecisions, usePendingDecisions } from "@/hooks/use-decisions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DecisionRequestCard } from "@/components/decisions/decision-request-card";
import { DecisionResponseDialog } from "@/components/decisions/decision-response-dialog";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";

export default function DecisionsPage() {
  const [selectedDecision, setSelectedDecision] = useState<string | undefined>();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [search, setSearch] = useState("");
  const { data: pendingDecisions } = usePendingDecisions();
  const { data: allDecisions } = useDecisions();

  const filteredDecisions = (tab === "pending" ? pendingDecisions : allDecisions)?.decisions.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.prompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container max-w-4xl py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Decision Requests</h1>
          <p className="text-muted-foreground">
            Review and respond to pending decisions
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Decision
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search decisions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "all")}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending {pendingDecisions && pendingDecisions.total > 0 && `(${pendingDecisions.total})`}
          </TabsTrigger>
          <TabsTrigger value="all">
            All {allDecisions && `(${allDecisions.total})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          <ScrollArea className="h-[calc(100vh-24rem)]">
            {filteredDecisions && filteredDecisions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredDecisions.map((decision) => (
                  <DecisionRequestCard
                    key={decision.id}
                    decision={decision}
                    onResponse={() => setSelectedDecision(decision.id)}
                    onViewDetails={() => setSelectedDecision(decision.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground">
                    {search ? "No decisions found" : tab === "pending" ? "No pending decisions" : "No decisions yet"}
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Response Dialog */}
      {(() => {
        const selected = filteredDecisions?.find((d) => d.id === selectedDecision);
        return selected ? (
          <DecisionResponseDialog
            decision={selected}
            open={!!selectedDecision}
            onOpenChange={(open) => !open && setSelectedDecision(undefined)}
          />
        ) : null;
      })()}
    </div>
  );
}

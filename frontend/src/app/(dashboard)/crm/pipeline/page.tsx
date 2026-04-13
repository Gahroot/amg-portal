"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OPPORTUNITY_STAGES } from "@/types/crm";
import type { Opportunity, OpportunityStage } from "@/types/crm";
import {
  useCreateOpportunity,
  useDeleteOpportunity,
  useOpportunities,
  useReorderOpportunity,
} from "@/hooks/use-crm";
import { updateOpportunity } from "@/lib/api/opportunities";
import { PipelineColumn } from "@/components/crm/pipeline-column";
import { OpportunityDialog } from "@/components/crm/opportunity-dialog";

export default function PipelinePage() {
  const { data } = useOpportunities({ limit: 500 });
  const createMutation = useCreateOpportunity();
  const reorderMutation = useReorderOpportunity();
  const deleteMutation = useDeleteOpportunity();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [defaultStage, setDefaultStage] = useState<OpportunityStage>("qualifying");
  const [activeOpportunity, setActiveOpportunity] = useState<Opportunity | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    const result: Record<OpportunityStage, Opportunity[]> = {
      qualifying: [],
      proposal: [],
      negotiation: [],
      won: [],
      lost: [],
    };
    for (const opp of data?.opportunities ?? []) {
      result[opp.stage].push(opp);
    }
    for (const stage of Object.keys(result) as OpportunityStage[]) {
      result[stage].sort((a, b) => a.position - b.position);
    }
    return result;
  }, [data]);

  const totals = useMemo(() => {
    const result: Record<OpportunityStage, number> = {
      qualifying: 0,
      proposal: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
    };
    for (const [stage, opps] of Object.entries(grouped) as [
      OpportunityStage,
      Opportunity[],
    ][]) {
      result[stage] = opps.reduce((acc, o) => acc + Number(o.value ?? 0), 0);
    }
    return result;
  }, [grouped]);

  const handleDragStart = (event: DragStartEvent) => {
    const opp = data?.opportunities.find((o) => o.id === event.active.id);
    if (opp) setActiveOpportunity(opp);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOpportunity(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as UniqueIdentifier;
    const opp = data?.opportunities.find((o) => o.id === activeId);
    if (!opp) return;

    const isColumnDrop = OPPORTUNITY_STAGES.some((s) => s.value === overId);
    if (isColumnDrop) {
      const newStage = overId as OpportunityStage;
      if (opp.stage !== newStage) {
        reorderMutation.mutate({
          id: activeId,
          data: { new_stage: newStage, after_opportunity_id: null },
        });
      }
      return;
    }

    const overOpp = data?.opportunities.find((o) => o.id === overId);
    if (overOpp && activeId !== overOpp.id) {
      reorderMutation.mutate({
        id: activeId,
        data: {
          new_stage: overOpp.stage,
          after_opportunity_id: String(overId),
        },
      });
    }
  };

  const handleAdd = (stage: OpportunityStage) => {
    setEditing(null);
    setDefaultStage(stage);
    setDialogOpen(true);
  };

  const handleEdit = (opportunity: Opportunity) => {
    setEditing(opportunity);
    setDefaultStage(opportunity.stage);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this opportunity?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} opportunities across{" "}
            {OPPORTUNITY_STAGES.length} stages.
          </p>
        </div>
        <Button onClick={() => handleAdd("qualifying")} className="gap-1.5">
          <Plus className="size-4" />
          New opportunity
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-4 overflow-x-auto pb-4">
            {OPPORTUNITY_STAGES.map((stage) => (
              <PipelineColumn
                key={stage.value}
                stage={stage.value}
                title={stage.label}
                color={stage.color}
                opportunities={grouped[stage.value]}
                totalValue={totals[stage.value]}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
          <DragOverlay>
            {activeOpportunity && (
              <div className="w-72 rounded-lg border bg-card p-3 shadow-lg">
                <h4 className="text-sm font-medium">
                  {activeOpportunity.title}
                </h4>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <OpportunityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        opportunity={editing}
        defaultStage={defaultStage}
        onSubmit={async (payload) => {
          if (editing) {
            await updateOpportunity(editing.id, payload);
          } else {
            await createMutation.mutateAsync(payload);
          }
        }}
      />
    </div>
  );
}

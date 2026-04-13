"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OpportunityCard } from "./opportunity-card";
import type { Opportunity, OpportunityStage } from "@/types/crm";

interface PipelineColumnProps {
  stage: OpportunityStage;
  title: string;
  color: string;
  opportunities: Opportunity[];
  totalValue: number;
  onAdd: (stage: OpportunityStage) => void;
  onEdit: (opportunity: Opportunity) => void;
  onDelete: (id: string) => void;
}

function formatShortCurrency(value: number): string {
  if (value === 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

export function PipelineColumn({
  stage,
  title,
  color,
  opportunities,
  totalValue,
  onAdd,
  onEdit,
  onDelete,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="flex h-full w-80 shrink-0 flex-col rounded-lg border bg-muted/30">
      <div className={cn("flex items-center justify-between rounded-t-lg px-3 py-2", color)}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="flex size-5 items-center justify-center rounded-full bg-background/50 text-xs font-medium">
            {opportunities.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {formatShortCurrency(totalValue)}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6"
            onClick={() => onAdd(stage)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 transition-colors",
          isOver && "bg-primary/5",
        )}
      >
        <ScrollArea className="h-full">
          <div className="space-y-2 p-2">
            <SortableContext
              items={opportunities.map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <AnimatePresence>
                {opportunities.map((opportunity) => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </AnimatePresence>
            </SortableContext>

            {opportunities.length === 0 && (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                Drop here
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

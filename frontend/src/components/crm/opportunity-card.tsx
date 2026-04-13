"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { CalendarDays, GripVertical, MoreHorizontal, Target } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Opportunity } from "@/types/crm";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onEdit: (opportunity: Opportunity) => void;
  onDelete: (id: string) => void;
}

function formatCurrency(value: string | null): string {
  if (!value) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function OpportunityCard({
  opportunity,
  onEdit,
  onDelete,
}: OpportunityCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-50",
      )}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100"
          {...listeners}
          aria-label="Drag"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onEdit(opportunity)}
          className="flex-1 text-left"
        >
          <h4 className="line-clamp-2 text-sm font-medium">{opportunity.title}</h4>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="size-6 shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(opportunity)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(opportunity.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1 font-medium text-foreground">
          {formatCurrency(opportunity.value)}
        </div>
        <div className="flex items-center gap-1">
          <Target className="size-3" />
          {opportunity.probability}%
        </div>
      </div>

      {opportunity.expected_close_date && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3" />
          {format(new Date(opportunity.expected_close_date), "MMM d, yyyy")}
        </div>
      )}
    </motion.div>
  );
}

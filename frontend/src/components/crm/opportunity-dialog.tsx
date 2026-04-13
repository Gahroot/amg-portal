"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPPORTUNITY_STAGES } from "@/types/crm";
import type {
  Opportunity,
  OpportunityCreateData,
  OpportunityStage,
} from "@/types/crm";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional(),
  stage: z.enum([
    "qualifying",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ] as const),
  value: z.string().optional(),
  probability: z.string().regex(/^\d{1,3}$/, "0–100"),
  expected_close_date: z.string().optional(),
  program_type: z.string().max(100).optional(),
  next_step: z.string().max(500).optional(),
  next_step_at: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface OpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity | null;
  defaultStage?: OpportunityStage;
  defaultLeadId?: string;
  onSubmit: (data: OpportunityCreateData) => Promise<void> | void;
}

export function OpportunityDialog({
  open,
  onOpenChange,
  opportunity,
  defaultStage = "qualifying",
  defaultLeadId,
  onSubmit,
}: OpportunityDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      stage: defaultStage,
      value: "",
      probability: "50",
      expected_close_date: "",
      program_type: "",
      next_step: "",
      next_step_at: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (opportunity) {
      form.reset({
        title: opportunity.title,
        description: opportunity.description ?? "",
        stage: opportunity.stage,
        value: opportunity.value ?? "",
        probability: String(opportunity.probability),
        expected_close_date: opportunity.expected_close_date ?? "",
        program_type: opportunity.program_type ?? "",
        next_step: opportunity.next_step ?? "",
        next_step_at: opportunity.next_step_at ?? "",
      });
    } else {
      form.reset({
        title: "",
        description: "",
        stage: defaultStage,
        value: "",
        probability: "50",
        expected_close_date: "",
        program_type: "",
        next_step: "",
        next_step_at: "",
      });
    }
  }, [open, opportunity, defaultStage, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: OpportunityCreateData = {
      title: values.title,
      description: values.description || null,
      stage: values.stage,
      value: values.value || null,
      probability: Math.min(100, Math.max(0, Number(values.probability) || 0)),
      expected_close_date: values.expected_close_date || null,
      program_type: values.program_type || null,
      next_step: values.next_step || null,
      next_step_at: values.next_step_at || null,
    };
    if (defaultLeadId && !opportunity) {
      payload.lead_id = defaultLeadId;
    }
    await onSubmit(payload);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {opportunity ? "Edit opportunity" : "New opportunity"}
          </DialogTitle>
          <DialogDescription>
            {opportunity
              ? "Update pipeline details for this opportunity."
              : "Create a new opportunity in the pipeline."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="e.g. Family office concierge program"
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="stage">Stage</Label>
              <Select
                value={form.watch("stage")}
                onValueChange={(v) => form.setValue("stage", v as OpportunityStage)}
              >
                <SelectTrigger id="stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="probability">Probability (%)</Label>
              <Input
                id="probability"
                type="number"
                min={0}
                max={100}
                {...form.register("probability")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="value">Value (USD)</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                {...form.register("value")}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expected_close_date">Expected close</Label>
              <Input
                id="expected_close_date"
                type="date"
                {...form.register("expected_close_date")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="program_type">Program type</Label>
            <Input
              id="program_type"
              {...form.register("program_type")}
              placeholder="e.g. Family office setup"
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="next_step">Next step</Label>
              <Input
                id="next_step"
                {...form.register("next_step")}
                placeholder="e.g. Send proposal draft"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_step_at">By</Label>
              <Input
                id="next_step_at"
                type="date"
                {...form.register("next_step_at")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              {...form.register("description")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {opportunity ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

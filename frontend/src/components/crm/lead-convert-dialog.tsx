"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { CLIENT_TYPES } from "@/types/crm";
import type { ClientType, Lead, LeadConvertRequest } from "@/types/crm";
import { leadConvertSchema, type LeadConvertFormValues } from "@/lib/validations/lead";

interface LeadConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSubmit: (data: LeadConvertRequest) => Promise<void> | void;
}

export function LeadConvertDialog({
  open,
  onOpenChange,
  lead,
  onSubmit,
}: LeadConvertDialogProps) {
  const form = useForm<LeadConvertFormValues>({
    resolver: zodResolver(leadConvertSchema),
    defaultValues: {
      legal_name: lead.company || lead.full_name,
      primary_email: lead.email ?? "",
      entity_type: lead.estimated_client_type ?? "uhnw_individual",
      phone: lead.phone ?? "",
      notes: lead.notes ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      legal_name: lead.company || lead.full_name,
      primary_email: lead.email ?? "",
      entity_type: lead.estimated_client_type ?? "uhnw_individual",
      phone: lead.phone ?? "",
      notes: lead.notes ?? "",
    });
  }, [open, lead, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      legal_name: values.legal_name,
      primary_email: values.primary_email,
      entity_type: values.entity_type,
      phone: values.phone || null,
      notes: values.notes || null,
    });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert to client</DialogTitle>
          <DialogDescription>
            This creates a client profile in the pending-compliance state and
            kicks off the intake workflow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="legal_name">Legal name</Label>
            <Input id="legal_name" {...form.register("legal_name")} />
            {form.formState.errors.legal_name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.legal_name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="primary_email">Primary email</Label>
            <Input
              id="primary_email"
              type="email"
              {...form.register("primary_email")}
            />
            {form.formState.errors.primary_email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.primary_email.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="entity_type">Entity type</Label>
              <Select
                value={form.watch("entity_type")}
                onValueChange={(v) =>
                  form.setValue("entity_type", v as ClientType)
                }
              >
                <SelectTrigger id="entity_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (for compliance)</Label>
            <Textarea id="notes" rows={3} {...form.register("notes")} />
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
              Convert to client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

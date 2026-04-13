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
import { CLIENT_TYPES, LEAD_SOURCES, LEAD_STATUSES } from "@/types/crm";
import type {
  ClientType,
  Lead,
  LeadCreateData,
  LeadSource,
  LeadStatus,
} from "@/types/crm";

const schema = z.object({
  full_name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  status: z.enum([
    "new",
    "contacting",
    "qualifying",
    "qualified",
    "disqualified",
    "converted",
  ] as const),
  source: z.enum([
    "referral_partner",
    "existing_client",
    "inbound_web",
    "outbound",
    "event",
    "other",
  ] as const),
  source_details: z.string().max(500).optional(),
  estimated_value: z.string().optional(),
  estimated_client_type: z
    .enum(["uhnw_individual", "family_office", "global_executive"] as const)
    .optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSubmit: (data: LeadCreateData) => Promise<void> | void;
}

export function LeadDialog({
  open,
  onOpenChange,
  lead,
  onSubmit,
}: LeadDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      company: "",
      status: "new",
      source: "other",
      source_details: "",
      estimated_value: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (lead) {
      form.reset({
        full_name: lead.full_name,
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        company: lead.company ?? "",
        status: lead.status,
        source: lead.source,
        source_details: lead.source_details ?? "",
        estimated_value: lead.estimated_value ?? "",
        estimated_client_type: lead.estimated_client_type ?? undefined,
        notes: lead.notes ?? "",
      });
    } else {
      form.reset({
        full_name: "",
        email: "",
        phone: "",
        company: "",
        status: "new",
        source: "other",
        source_details: "",
        estimated_value: "",
        notes: "",
      });
    }
  }, [open, lead, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: LeadCreateData = {
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone || null,
      company: values.company || null,
      status: values.status,
      source: values.source,
      source_details: values.source_details || null,
      estimated_value: values.estimated_value || null,
      estimated_client_type: values.estimated_client_type ?? null,
      notes: values.notes || null,
    };
    await onSubmit(payload);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>
            Capture early-stage prospect details before compliance intake.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" {...form.register("full_name")} />
            {form.formState.errors.full_name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.full_name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company">Company / entity</Label>
            <Input id="company" {...form.register("company")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as LeadStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Select
                value={form.watch("source")}
                onValueChange={(v) => form.setValue("source", v as LeadSource)}
              >
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source_details">Source details</Label>
            <Input
              id="source_details"
              {...form.register("source_details")}
              placeholder="e.g. Referred by partner Acme Advisors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="estimated_value">Estimated value (USD)</Label>
              <Input
                id="estimated_value"
                type="number"
                step="0.01"
                {...form.register("estimated_value")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimated_client_type">Client type</Label>
              <Select
                value={form.watch("estimated_client_type") ?? ""}
                onValueChange={(v) =>
                  form.setValue(
                    "estimated_client_type",
                    (v || undefined) as ClientType | undefined,
                  )
                }
              >
                <SelectTrigger id="estimated_client_type">
                  <SelectValue placeholder="—" />
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
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
              {lead ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

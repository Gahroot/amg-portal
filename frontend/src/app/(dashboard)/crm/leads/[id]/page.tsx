"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAD_SOURCES } from "@/types/crm";
import {
  useLead,
  useConvertLead,
  useDeleteLead,
  useUpdateLead,
} from "@/hooks/use-crm";
import { LeadDialog } from "@/components/crm/lead-dialog";
import { LeadConvertDialog } from "@/components/crm/lead-convert-dialog";
import { ActivityTimeline } from "@/components/crm/activity-timeline";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const { data: lead, isLoading } = useLead(leadId);
  const updateMutation = useUpdateLead(leadId);
  const deleteMutation = useDeleteLead();
  const convertMutation = useConvertLead(leadId);

  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Lead not found.</p>
      </div>
    );
  }

  const sourceLabel =
    LEAD_SOURCES.find((s) => s.value === lead.source)?.label ?? lead.source;
  const converted = lead.status === "converted";

  return (
    <div className="space-y-6 p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => router.push("/crm/leads")}
        >
          <ArrowLeft className="size-4" />
          Back to leads
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {lead.full_name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary">{lead.status.replace(/_/g, " ")}</Badge>
            <span className="text-sm text-muted-foreground">
              Source: {sourceLabel}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
          {!converted && (
            <Button onClick={() => setConvertOpen(true)}>
              <UserCheck className="size-4" />
              Convert to client
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={async () => {
              if (confirm("Delete this lead?")) {
                await deleteMutation.mutateAsync(leadId);
                router.push("/crm/leads");
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-semibold">Contact</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{lead.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{lead.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Company</dt>
              <dd>{lead.company ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Source details</dt>
              <dd>{lead.source_details ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Estimated value</dt>
              <dd>
                {lead.estimated_value
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(Number(lead.estimated_value))
                  : "—"}
              </dd>
            </div>
            {lead.notes && (
              <div>
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{lead.notes}</dd>
              </div>
            )}
            {converted && lead.converted_client_profile_id && (
              <div className="border-t pt-3">
                <Link
                  href={`/clients/${lead.converted_client_profile_id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View client profile →
                </Link>
              </div>
            )}
          </dl>
        </Card>

        <div className="lg:col-span-2">
          <h3 className="mb-3 font-semibold">Activity</h3>
          <ActivityTimeline leadId={leadId} />
        </div>
      </div>

      <LeadDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        onSubmit={async (data) => {
          await updateMutation.mutateAsync(data);
        }}
      />

      <LeadConvertDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={lead}
        onSubmit={async (data) => {
          const updated = await convertMutation.mutateAsync(data);
          if (updated.converted_client_profile_id) {
            router.push(`/clients/${updated.converted_client_profile_id}`);
          }
        }}
      />
    </div>
  );
}

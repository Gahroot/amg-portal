"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { getEscalation } from "@/lib/api/escalations";
import { getEscalationPlaybook } from "@/lib/api/escalation-playbooks";
import { PlaybookViewer } from "@/components/escalations/playbook-viewer";
import { Button } from "@/components/ui/button";
import { EscalationLevelBadge } from "@/components/escalations/level-badge";
import { EscalationStatusBadge } from "@/components/escalations/status-badge";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

export default function PlaybookPage({
  params,
}: {
  params: { id: string };
}) {
  const { user } = useAuth();
  const router = useRouter();

  const escalationQuery = useQuery({
    queryKey: ["escalations", params.id],
    queryFn: () => getEscalation(params.id),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const playbookQuery = useQuery({
    queryKey: ["escalation-playbook", params.id],
    queryFn: () => getEscalationPlaybook(params.id),
    enabled:
      !!user &&
      ALLOWED_ROLES.includes(user.role) &&
      escalationQuery.isSuccess,
    retry: false,
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  if (escalationQuery.isLoading || playbookQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading playbook…</p>
      </div>
    );
  }

  if (escalationQuery.error || !escalationQuery.data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Escalation not found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  const escalation = escalationQuery.data;

  if (playbookQuery.isError) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight">
                Resolution Playbook
              </h1>
              <p className="text-sm text-muted-foreground">{escalation.title}</p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <h2 className="font-medium text-muted-foreground">
              No playbook available
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No resolution playbook has been configured for{" "}
              <strong>{escalation.entity_type}</strong>-type escalations yet.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              A Managing Director can seed default playbooks from the
              escalations settings.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              asChild
            >
              <Link href={`/escalations/${params.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Escalation
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!playbookQuery.data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="mt-1"
            asChild
          >
            <Link href={`/escalations/${params.id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-serif text-2xl font-bold tracking-tight">
              Resolution Playbook
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {escalation.title}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <EscalationLevelBadge level={escalation.level} />
              <EscalationStatusBadge status={escalation.status} />
            </div>
          </div>
        </div>

        {/* Playbook viewer */}
        <PlaybookViewer
          escalationId={params.id}
          data={playbookQuery.data}
        />
      </div>
    </div>
  );
}

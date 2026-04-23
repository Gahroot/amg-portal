"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCompositeScore,
  getGovernanceHistory,
} from "@/lib/api/partner-governance";
import type { GovernanceAction as GovernanceActionType } from "@/types/partner-governance";
import { PartnerScoreCard } from "@/components/partners/partner-score-card";
import { GovernanceActionForm } from "@/components/partners/governance-action-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const GOVERNANCE_ACTION_LABELS: Record<string, string> = {
  warning: "Warning",
  probation: "Probation",
  suspension: "Suspension",
  termination: "Termination",
  reinstatement: "Reinstatement",
};

const GOVERNANCE_ACTION_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  warning: "secondary",
  probation: "outline",
  suspension: "destructive",
  termination: "destructive",
  reinstatement: "default",
};

interface PartnerScorecardProps {
  partnerId: string;
  partnerName: string;
  isMD: boolean;
}

export function PartnerScorecard({ partnerId, partnerName, isMD }: PartnerScorecardProps) {
  const [govDialogOpen, setGovDialogOpen] = useState(false);

  const { data: compositeScore, isLoading: scoreLoading } = useQuery({
    queryKey: ["composite-score", partnerId],
    queryFn: () => getCompositeScore(partnerId),
  });

  const { data: governanceHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["governance-history", partnerId],
    queryFn: () => getGovernanceHistory(partnerId),
  });

  if (scoreLoading || historyLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading governance data...
      </p>
    );
  }

  const actions = governanceHistory?.actions ?? [];

  return (
    <div className="space-y-4">
      {compositeScore && <PartnerScoreCard data={compositeScore} />}

      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">
          Governance History
        </h3>
        {isMD && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setGovDialogOpen(true)}
          >
            Apply Governance Action
          </Button>
        )}
      </div>

      {actions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No governance actions on record for this partner.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {actions.map((action: GovernanceActionType) => (
            <Card key={action.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        GOVERNANCE_ACTION_VARIANT[action.action] ?? "outline"
                      }
                    >
                      {GOVERNANCE_ACTION_LABELS[action.action] ??
                        action.action}
                    </Badge>
                    {action.expiry_date && (
                      <span className="text-xs text-muted-foreground">
                        Expires{" "}
                        {new Date(action.expiry_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(action.effective_date).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {action.reason}
                </p>
                <div className="text-xs text-muted-foreground pt-1 border-t">
                  Issued by {action.issuer_name ?? "Managing Director"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GovernanceActionForm
        partnerId={partnerId}
        partnerName={partnerName}
        open={govDialogOpen}
        onOpenChange={setGovDialogOpen}
      />
    </div>
  );
}

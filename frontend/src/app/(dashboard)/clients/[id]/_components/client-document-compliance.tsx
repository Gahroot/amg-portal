"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  useClientProfile,
  useComplianceCertificate,
  useSecurityBrief,
} from "@/hooks/use-clients";
import type { SecurityProfileLevel } from "@/types/client";

const COMPLIANCE_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  cleared: "default",
  pending_review: "secondary",
  under_review: "secondary",
  flagged: "destructive",
  rejected: "destructive",
};

export function ClientDocumentCompliance({
  id,
  profile,
}: {
  id: string;
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
}) {
  const {
    data: certificate,
    refetch,
    isFetching,
  } = useComplianceCertificate(id);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <Badge
                variant={
                  COMPLIANCE_STATUS_VARIANT[profile.compliance_status] ??
                  "outline"
                }
              >
                {profile.compliance_status.replace(/_/g, " ")}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Reviewed By
              </p>
              <p className="text-sm">
                {profile.compliance_reviewed_by || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Reviewed At
              </p>
              <p className="text-sm">
                {profile.compliance_reviewed_at
                  ? new Date(profile.compliance_reviewed_at).toLocaleString()
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Notes
              </p>
              <p className="text-sm">{profile.compliance_notes || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {profile.compliance_status === "cleared" && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Certificate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Loading..." : "Download Certificate"}
            </Button>
            {certificate && (
              <div className="rounded border p-4 bg-muted/50 space-y-2 text-sm">
                <p>
                  <span className="font-medium">Legal Name:</span>{" "}
                  {certificate.legal_name}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  {certificate.compliance_status}
                </p>
                <p>
                  <span className="font-medium">Reviewed By:</span>{" "}
                  {certificate.reviewed_by || "-"}
                </p>
                <p>
                  <span className="font-medium">Certificate Date:</span>{" "}
                  {certificate.certificate_date}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const SECURITY_LEVEL_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  standard: "outline",
  elevated: "secondary",
  executive: "default",
};

const SECURITY_LEVEL_LABELS: Record<string, string> = {
  standard: "Standard",
  elevated: "Elevated",
  executive: "Executive",
};

const THREAT_LEVEL_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  low: "default",
  medium: "secondary",
  high: "destructive",
  critical: "destructive",
  unknown: "outline",
};

export function ClientSecurityProfile({
  id,
  securityProfileLevel,
  onUpdateLevel,
  isUpdating,
}: {
  id: string;
  securityProfileLevel: SecurityProfileLevel;
  onUpdateLevel: (level: SecurityProfileLevel) => void;
  isUpdating: boolean;
}) {
  const isElevatedOrExecutive =
    securityProfileLevel === "elevated" || securityProfileLevel === "executive";

  const {
    data: brief,
    isLoading: briefLoading,
    error: briefError,
    refetch,
    isFetching,
  } = useSecurityBrief(id, isElevatedOrExecutive);

  return (
    <div className="space-y-4">
      <Alert className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300">
        <AlertDescription className="text-sm font-medium">
          ⚠ Security information is strictly need-to-know. Access to this tab
          is logged and audited. Do not share or export this data.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">
            Security Profile Level
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Current level:</p>
            <Badge
              variant={
                SECURITY_LEVEL_VARIANT[securityProfileLevel] ?? "outline"
              }
            >
              {SECURITY_LEVEL_LABELS[securityProfileLevel] ??
                securityProfileLevel}
            </Badge>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Change level
            </p>
            <div className="flex flex-wrap gap-2">
              {(["standard", "elevated", "executive"] as SecurityProfileLevel[]).map(
                (level) => (
                  <Button
                    key={level}
                    size="sm"
                    variant={
                      securityProfileLevel === level ? "default" : "outline"
                    }
                    disabled={isUpdating || securityProfileLevel === level}
                    onClick={() => onUpdateLevel(level)}
                  >
                    {SECURITY_LEVEL_LABELS[level]}
                  </Button>
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              <strong>Standard</strong> — no feed integration.{" "}
              <strong>Elevated</strong> — travel advisories.{" "}
              <strong>Executive</strong> — full intelligence brief with threat
              monitoring.
            </p>
          </div>
        </CardContent>
      </Card>

      {isElevatedOrExecutive && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl">
              Intelligence Brief
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {briefLoading && (
              <p className="text-sm text-muted-foreground">
                Loading brief…
              </p>
            )}

            {briefError && !briefLoading && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">
                  Unable to load security brief. The feed may be offline or
                  this client may not have a qualifying profile level.
                </AlertDescription>
              </Alert>
            )}

            {brief && !briefLoading && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">Feed status:</p>
                  <Badge
                    variant={
                      brief.feed_connected ? "default" : "outline"
                    }
                  >
                    {brief.feed_connected ? "Connected" : "Offline"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Provider: {brief.provider} · Generated:{" "}
                    {new Date(brief.generated_at).toLocaleString()}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Threat Summary</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Threat level:
                    </span>
                    <Badge
                      variant={
                        THREAT_LEVEL_VARIANT[
                          brief.threat_summary.threat_level
                        ] ?? "outline"
                      }
                    >
                      {brief.threat_summary.threat_level.toUpperCase()}
                    </Badge>
                  </div>
                  {brief.threat_summary.note && (
                    <p className="text-xs text-muted-foreground italic">
                      {brief.threat_summary.note}
                    </p>
                  )}
                  {brief.threat_summary.alerts.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {brief.threat_summary.alerts.map((alert, i) => (
                        <div
                          key={alert.alert_id ?? i}
                          className="rounded border p-3 text-sm"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="destructive" className="text-xs">
                              {alert.severity}
                            </Badge>
                            <span className="font-medium">{alert.title}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {alert.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No active alerts.
                    </p>
                  )}
                </div>

                {brief.travel_advisories.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Travel Advisories</p>
                      {brief.travel_advisories.map((adv) => (
                        <div
                          key={adv.destination}
                          className="rounded border p-3 text-sm space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {adv.destination}
                            </span>
                            <Badge
                              variant={
                                THREAT_LEVEL_VARIANT[adv.risk_level] ??
                                "outline"
                              }
                            >
                              {adv.risk_level}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {adv.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Separator />
                <p className="text-xs text-muted-foreground italic">
                  {brief.disclaimer}
                </p>
                <p className="text-xs text-muted-foreground">
                  ✓ This access has been logged to the audit trail.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

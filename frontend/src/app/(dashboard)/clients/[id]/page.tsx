"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  useClientProfile,
  useUpdateIntelligenceFile,
  useComplianceCertificate,
} from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClientProvisionDialog } from "@/components/client-provision-dialog";

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

const APPROVAL_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  approved: "default",
  pending_compliance: "secondary",
  compliance_cleared: "secondary",
  pending_md_approval: "secondary",
  rejected: "destructive",
  draft: "outline",
};

type Tab = "overview" | "intelligence" | "compliance" | "provisioning";

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: profile, isLoading } = useClientProfile(id);
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const [provisionOpen, setProvisionOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Client profile not found.</p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "intelligence", label: "Intelligence" },
    { key: "compliance", label: "Compliance" },
    { key: "provisioning", label: "Provisioning" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {profile.display_name || profile.legal_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {profile.legal_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                COMPLIANCE_STATUS_VARIANT[profile.compliance_status] ??
                "outline"
              }
            >
              {profile.compliance_status.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant={
                APPROVAL_STATUS_VARIANT[profile.approval_status] ?? "outline"
              }
            >
              {profile.approval_status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>

        <div className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && <OverviewTab profile={profile} />}
        {activeTab === "intelligence" && (
          <IntelligenceTab id={id} profile={profile} />
        )}
        {activeTab === "compliance" && <ComplianceTab id={id} profile={profile} />}
        {activeTab === "provisioning" && (
          <ProvisioningTab
            profile={profile}
            onProvision={() => setProvisionOpen(true)}
          />
        )}

        <ClientProvisionDialog
          profileId={id}
          open={provisionOpen}
          onOpenChange={setProvisionOpen}
        />
      </div>
    </div>
  );
}

function OverviewTab({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
}) {
  const fields = [
    { label: "Legal Name", value: profile.legal_name },
    { label: "Display Name", value: profile.display_name },
    { label: "Entity Type", value: profile.entity_type },
    { label: "Jurisdiction", value: profile.jurisdiction },
    { label: "Tax ID", value: profile.tax_id },
    { label: "Primary Email", value: profile.primary_email },
    { label: "Secondary Email", value: profile.secondary_email },
    { label: "Phone", value: profile.phone },
    { label: "Address", value: profile.address },
    { label: "Communication Preference", value: profile.communication_preference },
    { label: "Sensitivities", value: profile.sensitivities },
    { label: "Special Instructions", value: profile.special_instructions },
    {
      label: "Created",
      value: new Date(profile.created_at).toLocaleDateString(),
    },
    {
      label: "Updated",
      value: new Date(profile.updated_at).toLocaleDateString(),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl">Profile Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.label}>
              <p className="text-sm font-medium text-muted-foreground">
                {field.label}
              </p>
              <p className="text-sm">{field.value || "-"}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function IntelligenceTab({
  id,
  profile,
}: {
  id: string;
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
}) {
  const [json, setJson] = React.useState(
    JSON.stringify(profile.intelligence_file ?? {}, null, 2)
  );
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const updateMutation = useUpdateIntelligenceFile(id);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    try {
      const parsed = JSON.parse(json);
      await updateMutation.mutateAsync(parsed);
      setSuccess(true);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError("Invalid JSON format.");
      } else {
        setError("Failed to update intelligence file.");
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl">Intelligence File</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>Intelligence file updated.</AlertDescription>
          </Alert>
        )}
        <Textarea
          className="font-mono text-sm min-h-[300px]"
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ComplianceTab({
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

function ProvisioningTab({
  profile,
  onProvision,
}: {
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
  onProvision: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl">
          Provisioning Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Portal Access
            </p>
            <p className="text-sm">
              {profile.portal_access_enabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Welcome Email Sent
            </p>
            <p className="text-sm">
              {profile.welcome_email_sent ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              User Account
            </p>
            <p className="text-sm">
              {profile.user_id ? "Created" : "Not created"}
            </p>
          </div>
        </div>

        {profile.approval_status === "approved" && !profile.user_id && (
          <Button onClick={onProvision}>Provision Client</Button>
        )}
      </CardContent>
    </Card>
  );
}

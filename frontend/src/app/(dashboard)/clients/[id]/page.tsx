"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  useClientProfile,
  useUpdateIntelligenceFile,
  useComplianceCertificate,
} from "@/hooks/use-clients";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClientProvisionDialog } from "@/components/client-provision-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { KYCDocumentPanel } from "@/components/documents/kyc-document-panel";
import { IntelligenceFileManager } from "@/components/intelligence/intelligence-file-manager";
import { FamilyMemberList } from "@/components/intake/family-member-list";
import { FamilyMemberDialog } from "@/components/intake/family-member-dialog";
import {
  useCreateFamilyMember,
  useUpdateFamilyMember,
  useDeleteFamilyMember,
} from "@/hooks/use-family-members";
import type { FamilyMemberCreate } from "@/types/family-member";

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

type Tab = "overview" | "intelligence" | "family" | "lifestyle" | "compliance" | "provisioning" | "documents" | "kyc";

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: profile, isLoading } = useClientProfile(id);
  const { data: familyMembersData } = useFamilyMembers(id);
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const [provisionOpen, setProvisionOpen] = React.useState(false);
  const [familyDialogOpen, setFamilyDialogOpen] = React.useState(false);
  const [editingMemberId, setEditingMemberId] = React.useState<string | null>(null);

  const updateIntelMutation = useUpdateIntelligenceFile(id);
  const createFamilyMutation = useCreateFamilyMember(id);
  const updateFamilyMutation = useUpdateFamilyMember(id);
  const deleteFamilyMutation = useDeleteFamilyMember(id);

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
    { key: "family", label: "Family" },
    { key: "lifestyle", label: "Lifestyle" },
    { key: "compliance", label: "Compliance" },
    { key: "provisioning", label: "Provisioning" },
    { key: "documents", label: "Documents" },
    { key: "kyc", label: "KYC" },
  ];

  const handleUpdateIntelligence = async (data: Record<string, unknown>) => {
    await updateIntelMutation.mutateAsync(data);
  };

  const handleFamilyMemberSubmit = async (data: FamilyMemberCreate) => {
    if (editingMemberId) {
      await updateFamilyMutation.mutateAsync({
        memberId: editingMemberId,
        data,
      });
      setEditingMemberId(null);
    } else {
      await createFamilyMutation.mutateAsync(data);
    }
    setFamilyDialogOpen(false);
  };

  const handleDeleteFamilyMember = async (memberId: string) => {
    if (confirm("Are you sure you want to remove this family member?")) {
      await deleteFamilyMutation.mutateAsync(memberId);
    }
  };

  const familyMembers = familyMembersData?.family_members || [];

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

        <div className="flex gap-1 border-b overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
          <IntelligenceTab
            id={id}
            profile={profile}
            onUpdate={handleUpdateIntelligence}
            isUpdating={updateIntelMutation.isPending}
          />
        )}
        {activeTab === "family" && (
          <FamilyTab
            familyMembers={familyMembers}
            onAddMember={() => {
              setEditingMemberId(null);
              setFamilyDialogOpen(true);
            }}
            onEditMember={(memberId) => {
              setEditingMemberId(memberId);
              setFamilyDialogOpen(true);
            }}
            onDeleteMember={handleDeleteFamilyMember}
            dialogOpen={familyDialogOpen}
            setDialogOpen={setFamilyDialogOpen}
            onDialogSubmit={handleFamilyMemberSubmit}
            editingMemberId={editingMemberId}
          />
        )}
        {activeTab === "lifestyle" && (
          <LifestyleTab profile={profile} />
        )}
        {activeTab === "compliance" && <ComplianceTab id={id} profile={profile} />}
        {activeTab === "documents" && (
          <DocumentList entityType="client" entityId={id} />
        )}
        {activeTab === "kyc" && (
          <KYCDocumentPanel clientId={id} canVerify={true} />
        )}
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
  onUpdate,
  isUpdating,
}: {
  id: string;
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
  isUpdating: boolean;
}) {
  return (
    <IntelligenceFileManager
      profileId={id}
      intelligenceFile={profile.intelligence_file}
      onUpdate={onUpdate}
      isUpdating={isUpdating}
    />
  );
}

function FamilyTab({
  familyMembers,
  onAddMember,
  onEditMember,
  onDeleteMember,
  dialogOpen,
  setDialogOpen,
  onDialogSubmit,
  editingMemberId,
}: {
  familyMembers: Array<{ id: string; name: string; relationship_type: string; date_of_birth: string | null; occupation: string | null; notes: string | null; is_primary_contact: boolean }>;
  onAddMember: () => void;
  onEditMember: (memberId: string) => void;
  onDeleteMember: (memberId: string) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  onDialogSubmit: (data: FamilyMemberCreate) => Promise<void>;
  editingMemberId: string | null;
}) {
  const editingMember = editingMemberId
    ? familyMembers.find((m) => m.id === editingMemberId)
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-xl">Family Members</CardTitle>
        <Button onClick={onAddMember}>Add Member</Button>
      </CardHeader>
      <CardContent>
        {familyMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No family members added yet.</p>
            <Button variant="outline" className="mt-4" onClick={onAddMember}>
              Add First Member
            </Button>
          </div>
        ) : (
          <FamilyMemberList
            members={familyMembers.map((m) => ({
              name: m.name,
              relationship_type: m.relationship_type as "spouse" | "partner" | "child" | "parent" | "sibling" | "grandparent" | "grandchild" | "aunt_uncle" | "cousin" | "in_law" | "other",
              date_of_birth: m.date_of_birth || undefined,
              occupation: m.occupation || undefined,
              notes: m.notes || undefined,
              is_primary_contact: m.is_primary_contact,
            }))}
            onEdit={(index) => onEditMember(familyMembers[index].id)}
            onDelete={(index) => onDeleteMember(familyMembers[index].id)}
          />
        )}
      </CardContent>

      <FamilyMemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={onDialogSubmit}
        initialData={
          editingMember
            ? {
                name: editingMember.name,
                relationship_type: editingMember.relationship_type as "spouse" | "partner" | "child" | "parent" | "sibling" | "grandparent" | "grandchild" | "aunt_uncle" | "cousin" | "in_law" | "other",
                date_of_birth: editingMember.date_of_birth || undefined,
                occupation: editingMember.occupation || undefined,
                notes: editingMember.notes || undefined,
                is_primary_contact: editingMember.is_primary_contact,
              }
            : undefined
        }
        isEditing={!!editingMemberId}
      />
    </Card>
  );
}

function LifestyleTab({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
}) {
  const lifestyle = (profile.intelligence_file?.lifestyle as Record<string, unknown>) || {};

  const fields = [
    { label: "Travel Preferences", value: lifestyle.travel_preferences },
    { label: "Dietary Restrictions", value: lifestyle.dietary_restrictions },
    { label: "Interests", value: lifestyle.interests },
    { label: "Language Preference", value: lifestyle.language_preference },
  ];

  const destinations = lifestyle.preferred_destinations as string[] | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl">Lifestyle & Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.label}>
              <p className="text-sm font-medium text-muted-foreground">
                {field.label}
              </p>
              <p className="text-sm">{(field.value as string) || "-"}</p>
            </div>
          ))}
        </div>

        {destinations && destinations.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Preferred Destinations
            </p>
            <div className="flex flex-wrap gap-2">
              {destinations.map((dest) => (
                <Badge key={dest} variant="secondary">
                  {dest}
                </Badge>
              ))}
            </div>
          </div>
        )}
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

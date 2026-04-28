"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  useClientProfile,
  useUpdateIntelligenceFile,
  useUpdateClientProfile,
  useComplianceCertificate,
  useSecurityBrief,
  useUpdateSecurityProfileLevel,
} from "@/hooks/use-clients";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Pencil } from "lucide-react";
import { ClientProvisionDialog } from "@/components/client-provision-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { KYCDocumentPanel } from "@/components/documents/kyc-document-panel";
import { IntelligenceFileManager } from "@/components/intelligence/intelligence-file-manager";
import { IntelligenceNotesEditor } from "@/components/intelligence/intelligence-notes-editor";
import { FamilyMemberList } from "@/components/intake/family-member-list";
import { FamilyMemberDialog } from "@/components/intake/family-member-dialog";
import { ClientPreferencesForm } from "@/components/communications/client-preferences-form";
import { ClientPreferenceCard } from "@/components/clients/client-preference-card";
import { ImportantDatesForm } from "@/components/clients/important-dates-form";
import { BookmarkButton } from "@/components/ui/bookmark-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AuditTrailViewer } from "@/components/communications/audit-trail-viewer";
import {
  useCreateFamilyMember,
  useUpdateFamilyMember,
  useDeleteFamilyMember,
} from "@/hooks/use-family-members";
import type { FamilyMemberCreate } from "@/types/family-member";
import type { IntelligenceFile, SecurityProfileLevel, LifestyleProfile } from "@/types/client";

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

type Tab = "overview" | "intelligence" | "family" | "lifestyle" | "compliance" | "provisioning" | "documents" | "kyc" | "preferences" | "security" | "dates" | "activity";

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { data: profile, isLoading } = useClientProfile(id);
  const { data: familyMembersData } = useFamilyMembers(id);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [pendingDeleteMemberId, setPendingDeleteMemberId] = useState<string | null>(null);

  const isInternalSenior =
    user?.role === "managing_director" || user?.role === "relationship_manager";

  const updateIntelMutation = useUpdateIntelligenceFile(id);
  const updateSecurityLevelMutation = useUpdateSecurityProfileLevel(id);
  const createFamilyMutation = useCreateFamilyMember(id);
  const updateFamilyMutation = useUpdateFamilyMember(id);
  const deleteFamilyMutation = useDeleteFamilyMember(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-8">
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
    { key: "preferences", label: "Preferences" },
    { key: "activity", label: "Activity" },
    ...(isInternalSenior
      ? [
          { key: "dates" as Tab, label: "Important Dates" },
          { key: "security" as Tab, label: "Security" },
        ]
      : []),
  ];

  const handleUpdateIntelligence = async (data: IntelligenceFile) => {
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

  const handleDeleteFamilyMember = (memberId: string) => {
    setPendingDeleteMemberId(memberId);
  };

  const familyMembers = familyMembersData?.family_members || [];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-2">
            <div className="space-y-1">
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                {profile.display_name || profile.legal_name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {profile.legal_name}
              </p>
            </div>
            <BookmarkButton
              entityType="client"
              entityId={id}
              entityTitle={profile.display_name || profile.legal_name}
              entitySubtitle={profile.legal_name}
              className="mt-1"
            />
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

        {activeTab === "overview" && (
          <OverviewTab
            profile={profile}
            clientId={id}
            onEditPreferences={() => setActiveTab("preferences")}
          />
        )}
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
          <LifestyleTab id={id} profile={profile} />
        )}
        {activeTab === "compliance" && <ComplianceTab id={id} profile={profile} />}
        {activeTab === "documents" && (
          <DocumentList entityType="client" entityId={id} showRequest />
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
        {activeTab === "preferences" && (
          <ClientPreferencesForm
            clientId={id}
            readOnly={!isInternalSenior}
          />
        )}
        {activeTab === "dates" && isInternalSenior && (
          <ImportantDatesForm clientId={id} profile={profile} />
        )}
        {activeTab === "activity" && (
          <AuditTrailViewer
            title="Communications Audit Trail"
            searchParams={{ limit: 100 }}
          />
        )}
        {activeTab === "security" && isInternalSenior && (
          <SecurityProfileTab
            id={id}
            securityProfileLevel={profile.security_profile_level as SecurityProfileLevel}
            onUpdateLevel={(level) =>
              updateSecurityLevelMutation.mutate({
                security_profile_level: level,
              })
            }
            isUpdating={updateSecurityLevelMutation.isPending}
          />
        )}

        <ClientProvisionDialog
          profileId={id}
          open={provisionOpen}
          onOpenChange={setProvisionOpen}
        />

        <ConfirmDialog
          open={pendingDeleteMemberId !== null}
          onOpenChange={(open) => !open && setPendingDeleteMemberId(null)}
          title="Remove family member?"
          description="This will permanently remove the family member from the profile."
          confirmLabel="Remove"
          onConfirm={async () => {
            if (pendingDeleteMemberId) {
              await deleteFamilyMutation.mutateAsync(pendingDeleteMemberId);
              setPendingDeleteMemberId(null);
            }
          }}
        />
      </div>
    </div>
  );
}

function OverviewTab({
  profile,
  clientId,
  onEditPreferences,
}: {
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
  clientId: string;
  onEditPreferences: () => void;
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
    <div className="space-y-4">
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
      <ClientPreferenceCard
        clientId={clientId}
        onEditClick={onEditPreferences}
      />
    </div>
  );
}

const INTELLIGENCE_NOTES_SECTIONS = [
  { key: "sensitivities", label: "Sensitivities" },
  { key: "special_instructions", label: "Special Instructions" },
  { key: "communication_preference", label: "Communication Preference" },
];

function IntelligenceTab({
  id,
  profile,
  onUpdate,
  isUpdating,
}: {
  id: string;
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
  onUpdate: (data: IntelligenceFile) => Promise<void>;
  isUpdating: boolean;
}) {
  const updateProfileMutation = useUpdateClientProfile(id);

  const notesInitialData = useMemo<Record<string, string>>(
    () => ({
      sensitivities: profile.sensitivities ?? "",
      special_instructions: profile.special_instructions ?? "",
      communication_preference: profile.communication_preference ?? "",
    }),
    [profile.sensitivities, profile.special_instructions, profile.communication_preference],
  );

  const handleSaveNotes = async (data: Record<string, string>) => {
    await updateProfileMutation.mutateAsync({
      sensitivities: data.sensitivities || undefined,
      special_instructions: data.special_instructions || undefined,
      communication_preference: data.communication_preference || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <IntelligenceFileManager
        profileId={id}
        intelligenceFile={(profile.intelligence_file ?? null) as IntelligenceFile | null}
        onUpdate={onUpdate}
        isUpdating={isUpdating}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">Intelligence Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <IntelligenceNotesEditor
            initialData={notesInitialData}
            sections={INTELLIGENCE_NOTES_SECTIONS}
            onSave={handleSaveNotes}
            isSaving={updateProfileMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
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
  familyMembers: Array<{ id: string; name: string; relationship_type: string; date_of_birth?: string | null; occupation?: string | null; notes?: string | null; is_primary_contact: boolean; [key: string]: unknown }>;
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
  id,
  profile,
}: {
  id: string;
  profile: NonNullable<ReturnType<typeof useClientProfile>["data"]>;
}) {
  const intelFile = (profile.intelligence_file as unknown as IntelligenceFile | null);
  const lifestyle = (intelFile?.lifestyle_profile ?? null) as LifestyleProfile | null;
  const updateMutation = useUpdateIntelligenceFile(id);

  const [editing, setEditing] = useState(false);
  const [travel, setTravel] = useState(lifestyle?.travel_preferences ?? "");
  const [dietary, setDietary] = useState(lifestyle?.dietary_restrictions ?? "");
  const [interests, setInterests] = useState((lifestyle?.interests ?? []).join(", "));
  const [language, setLanguage] = useState(lifestyle?.language_preference ?? "");
  const [destinations, setDestinations] = useState((lifestyle?.preferred_destinations ?? []).join(", "));

  const handleEdit = () => {
    setTravel(lifestyle?.travel_preferences ?? "");
    setDietary(lifestyle?.dietary_restrictions ?? "");
    setInterests((lifestyle?.interests ?? []).join(", "));
    setLanguage(lifestyle?.language_preference ?? "");
    setDestinations((lifestyle?.preferred_destinations ?? []).join(", "));
    setEditing(true);
  };

  const handleSave = async () => {
    const updatedLifestyle: LifestyleProfile = {
      travel_preferences: travel || null,
      dietary_restrictions: dietary || null,
      interests: interests ? interests.split(",").map((s) => s.trim()).filter(Boolean) : [],
      preferred_destinations: destinations ? destinations.split(",").map((s) => s.trim()).filter(Boolean) : [],
      language_preference: language || null,
    };
    const updatedFile: IntelligenceFile = {
      objectives: intelFile?.objectives ?? [],
      preferences: intelFile?.preferences ?? {},
      sensitivities: intelFile?.sensitivities ?? [],
      key_relationships: intelFile?.key_relationships ?? [],
      lifestyle_profile: updatedLifestyle,
    };
    await updateMutation.mutateAsync(updatedFile);
    setEditing(false);
  };

  const displayDestinations = lifestyle?.preferred_destinations ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-xl">Lifestyle & Preferences</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="travel">Travel Preferences</Label>
                <Input
                  id="travel"
                  value={travel}
                  onChange={(e) => setTravel(e.target.value)}
                  placeholder="e.g. First class, no red-eye flights"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dietary">Dietary Restrictions</Label>
                <Input
                  id="dietary"
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                  placeholder="e.g. Gluten-free, vegetarian"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="language">Language Preference</Label>
                <Input
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="e.g. English, French"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interests">Interests</Label>
                <Input
                  id="interests"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder="Comma-separated, e.g. Golf, Art, Music"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destinations">Preferred Destinations</Label>
              <Input
                id="destinations"
                value={destinations}
                onChange={(e) => setDestinations(e.target.value)}
                placeholder="Comma-separated, e.g. Paris, Tokyo, New York"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Travel Preferences</p>
                <p className="text-sm">{lifestyle?.travel_preferences || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dietary Restrictions</p>
                <p className="text-sm">{lifestyle?.dietary_restrictions || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Interests</p>
                <p className="text-sm">{(lifestyle?.interests ?? []).join(", ") || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Language Preference</p>
                <p className="text-sm">{lifestyle?.language_preference || "-"}</p>
              </div>
            </div>

            {displayDestinations.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Preferred Destinations
                </p>
                <div className="flex flex-wrap gap-2">
                  {displayDestinations.map((dest) => (
                    <Badge key={dest} variant="secondary">
                      {dest}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
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

// ---------------------------------------------------------------------------
// Security Profile Tab — MD + RM only, never shown in client/partner portals
// ---------------------------------------------------------------------------

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

function SecurityProfileTab({
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
      {/* Need-to-know disclaimer */}
      <Alert className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300">
        <AlertDescription className="text-sm font-medium">
          ⚠ Security information is strictly need-to-know. Access to this tab
          is logged and audited. Do not share or export this data.
        </AlertDescription>
      </Alert>

      {/* Security Profile Level */}
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

      {/* Live Intelligence Brief — only for elevated/executive */}
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
                {/* Feed status */}
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

                {/* Threat summary */}
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

                {/* Travel advisories */}
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

                {/* Disclaimer */}
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

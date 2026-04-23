"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClientPreferenceCard } from "@/components/clients/client-preference-card";
import { useClientProfile } from "@/hooks/use-clients";

export function ClientProfileCard({
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

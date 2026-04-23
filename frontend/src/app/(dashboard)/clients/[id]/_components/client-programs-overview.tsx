"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IntelligenceFileManager } from "@/components/intelligence/intelligence-file-manager";
import { IntelligenceNotesEditor } from "@/components/intelligence/intelligence-notes-editor";
import { useClientProfile, useUpdateClientProfile } from "@/hooks/use-clients";
import type { IntelligenceFile } from "@/types/client";

const INTELLIGENCE_NOTES_SECTIONS = [
  { key: "sensitivities", label: "Sensitivities" },
  { key: "special_instructions", label: "Special Instructions" },
  { key: "communication_preference", label: "Communication Preference" },
];

export function ClientProgramsOverview({
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

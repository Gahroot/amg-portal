"use client";

import * as React from "react";
import { FileText, Users, Plane, Heart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntelligenceNotesEditor } from "./intelligence-notes-editor";
import { DocumentList } from "@/components/documents/document-list";

type TabKey = "notes" | "documents" | "family" | "travel" | "lifestyle";

interface IntelligenceFileManagerProps {
  profileId: string;
  intelligenceFile: Record<string, unknown> | null;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
  isUpdating?: boolean;
}

export function IntelligenceFileManager({
  profileId,
  intelligenceFile,
  onUpdate,
  isUpdating = false,
}: IntelligenceFileManagerProps) {
  const [activeTab, setActiveTab] = React.useState<TabKey>("notes");

  const handleSaveNotes = async (section: string, data: unknown) => {
    const updated = {
      ...(intelligenceFile || {}),
      [section]: data,
    };
    await onUpdate(updated);
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "notes", label: "Notes", icon: <FileText className="size-4" /> },
    { key: "documents", label: "Documents", icon: <FileText className="size-4" /> },
    { key: "family", label: "Family Intel", icon: <Users className="size-4" /> },
    { key: "travel", label: "Travel", icon: <Plane className="size-4" /> },
    { key: "lifestyle", label: "Lifestyle", icon: <Heart className="size-4" /> },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-5">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-2">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Background & Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <IntelligenceNotesEditor
                initialData={
                  (intelligenceFile?.background as Record<string, string>) || {}
                }
                sections={[
                  { key: "background", label: "Background" },
                  { key: "business_interests", label: "Business Interests" },
                  { key: "philanthropy", label: "Philanthropy" },
                  { key: "key_relationships", label: "Key Relationships" },
                ]}
                onSave={(data) => handleSaveNotes("background", data)}
                isSaving={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Intelligence Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList
                entityType="client"
                entityId={profileId}
                showUpload={true}
                showDelete={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="family" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Family Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              <IntelligenceNotesEditor
                initialData={
                  (intelligenceFile?.family_intel as Record<string, string>) || {}
                }
                sections={[
                  { key: "family_structure", label: "Family Structure" },
                  { key: "key_family_members", label: "Key Family Members" },
                  { key: "family_dynamics", label: "Family Dynamics" },
                  { key: "succession_notes", label: "Succession Notes" },
                ]}
                onSave={(data) => handleSaveNotes("family_intel", data)}
                isSaving={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="travel" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Travel Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              <IntelligenceNotesEditor
                initialData={
                  (intelligenceFile?.travel_intel as Record<string, string>) || {}
                }
                sections={[
                  { key: "travel_patterns", label: "Travel Patterns" },
                  { key: "preferred_accommodations", label: "Preferred Accommodations" },
                  { key: "aviation_preferences", label: "Aviation Preferences" },
                  { key: "security_considerations", label: "Security Considerations" },
                ]}
                onSave={(data) => handleSaveNotes("travel_intel", data)}
                isSaving={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lifestyle" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lifestyle & Interests</CardTitle>
            </CardHeader>
            <CardContent>
              <IntelligenceNotesEditor
                initialData={
                  (intelligenceFile?.lifestyle_intel as Record<string, string>) || {}
                }
                sections={[
                  { key: "hobbies_interests", label: "Hobbies & Interests" },
                  { key: "sports_activities", label: "Sports & Activities" },
                  { key: "arts_culture", label: "Arts & Culture" },
                  { key: "dining_preferences", label: "Dining Preferences" },
                  { key: "social_calendar", label: "Social Calendar" },
                ]}
                onSave={(data) => handleSaveNotes("lifestyle_intel", data)}
                isSaving={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

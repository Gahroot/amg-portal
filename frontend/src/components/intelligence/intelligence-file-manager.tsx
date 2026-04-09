"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Target,
  Settings,
  AlertTriangle,
  Users,
  Heart,
  FileText,
  Plus,
  X,
  Save,
  Loader2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DocumentList } from "@/components/documents/document-list";
import { toast } from "sonner";
import type { IntelligenceFile } from "@/types/client";

// ---------------------------------------------------------------------------
// Form value types — useFieldArray requires objects, not primitives
// ---------------------------------------------------------------------------

interface StringItem {
  value: string;
}

interface PreferenceItem {
  key: string;
  value: string;
}

interface RelationshipItem {
  name: string;
  relationship: string;
  notes: string;
}

interface IntelligenceFormValues {
  objectives: StringItem[];
  preferences: PreferenceItem[];
  sensitivities: StringItem[];
  key_relationships: RelationshipItem[];
  lifestyle_travel_preferences: string;
  lifestyle_dietary_restrictions: string;
  lifestyle_interests: StringItem[];
  lifestyle_preferred_destinations: StringItem[];
  lifestyle_language_preference: string;
}

// ---------------------------------------------------------------------------
// Helpers — convert between API shape and form shape
// ---------------------------------------------------------------------------

const EMPTY_LIFESTYLE: IntelligenceFile["lifestyle_profile"] = {
  travel_preferences: null,
  dietary_restrictions: null,
  interests: [],
  preferred_destinations: [],
  language_preference: null,
};

function toFormValues(file: IntelligenceFile | null): IntelligenceFormValues {
  const lp = file?.lifestyle_profile ?? EMPTY_LIFESTYLE;
  return {
    objectives: (file?.objectives ?? []).map((v) => ({ value: v })),
    preferences: Object.entries(file?.preferences ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
    sensitivities: (file?.sensitivities ?? []).map((v) => ({ value: v })),
    key_relationships: (file?.key_relationships ?? []).map((r) => ({
      name: r.name,
      relationship: r.relationship,
      notes: r.notes ?? "",
    })),
    lifestyle_travel_preferences: lp.travel_preferences ?? "",
    lifestyle_dietary_restrictions: lp.dietary_restrictions ?? "",
    lifestyle_interests: (lp.interests ?? []).map((v) => ({ value: v })),
    lifestyle_preferred_destinations: (lp.preferred_destinations ?? []).map(
      (v) => ({ value: v })
    ),
    lifestyle_language_preference: lp.language_preference ?? "",
  };
}

function fromFormValues(values: IntelligenceFormValues): IntelligenceFile {
  const preferences: Record<string, string> = {};
  for (const { key, value } of values.preferences) {
    if (key.trim()) preferences[key.trim()] = value;
  }
  return {
    objectives: values.objectives.map((o) => o.value).filter(Boolean),
    preferences,
    sensitivities: values.sensitivities.map((s) => s.value).filter(Boolean),
    key_relationships: values.key_relationships
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name,
        relationship: r.relationship,
        notes: r.notes || null,
      })),
    lifestyle_profile: {
      travel_preferences: values.lifestyle_travel_preferences || null,
      dietary_restrictions: values.lifestyle_dietary_restrictions || null,
      interests: values.lifestyle_interests
        .map((i) => i.value)
        .filter(Boolean),
      preferred_destinations: values.lifestyle_preferred_destinations
        .map((d) => d.value)
        .filter(Boolean),
      language_preference: values.lifestyle_language_preference || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IntelligenceFileManagerProps {
  profileId: string;
  intelligenceFile: IntelligenceFile | null;
  onUpdate: (data: IntelligenceFile) => Promise<void>;
  isUpdating?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntelligenceFileManager({
  profileId,
  intelligenceFile,
  onUpdate,
  isUpdating = false,
}: IntelligenceFileManagerProps) {
  const [saving, setSaving] = useState(false);

  const { register, control, handleSubmit, reset, formState } =
    useForm<IntelligenceFormValues>({
      defaultValues: toFormValues(intelligenceFile),
    });

  // Reset when parent data changes (e.g. after a successful save)
  useEffect(() => {
    reset(toFormValues(intelligenceFile));
  }, [intelligenceFile, reset]);

  const objectives = useFieldArray({ control, name: "objectives" });
  const preferences = useFieldArray({ control, name: "preferences" });
  const sensitivities = useFieldArray({ control, name: "sensitivities" });
  const relationships = useFieldArray({ control, name: "key_relationships" });
  const interests = useFieldArray({ control, name: "lifestyle_interests" });
  const destinations = useFieldArray({
    control,
    name: "lifestyle_preferred_destinations",
  });

  const onSubmit = async (values: IntelligenceFormValues) => {
    setSaving(true);
    try {
      await onUpdate(fromFormValues(values));
      toast.success("Intelligence file saved");
    } catch {
      toast.error("Failed to save intelligence file");
    } finally {
      setSaving(false);
    }
  };

  const isBusy = saving || isUpdating;

  return (
    <Tabs defaultValue="intelligence">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="intelligence" className="gap-2">
          <FileText className="size-4" />
          Intelligence File
        </TabsTrigger>
        <TabsTrigger value="documents" className="gap-2">
          <FileText className="size-4" />
          Documents
        </TabsTrigger>
      </TabsList>

      {/* ------------------------------------------------------------------ */}
      {/* Intelligence File tab                                               */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="intelligence" className="mt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Save bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Edit each section below. All sections save together.
            </p>
            <Button type="submit" size="sm" disabled={isBusy}>
              {isBusy ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Save All
            </Button>
          </div>

          {formState.isDirty && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
              <span>You have unsaved changes</span>
            </div>
          )}

          <Accordion
            type="multiple"
            defaultValue={[
              "objectives",
              "preferences",
              "sensitivities",
              "key_relationships",
              "lifestyle_profile",
            ]}
            className="space-y-2"
          >
            {/* ---- Objectives ---- */}
            <AccordionItem
              value="objectives"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-muted-foreground" />
                  <span className="font-medium">Objectives</span>
                  {objectives.fields.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {objectives.fields.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-2">
                {objectives.fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2">
                    <Input
                      {...register(`objectives.${idx}.value`)}
                      placeholder="e.g. Preserve generational wealth"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => objectives.remove(idx)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => objectives.append({ value: "" })}
                >
                  <Plus className="size-4 mr-1" />
                  Add Objective
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* ---- Preferences ---- */}
            <AccordionItem
              value="preferences"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-muted-foreground" />
                  <span className="font-medium">Preferences</span>
                  {preferences.fields.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {preferences.fields.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-2">
                {preferences.fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2">
                    <Input
                      {...register(`preferences.${idx}.key`)}
                      placeholder="Category (e.g. travel)"
                      className="w-40 shrink-0"
                    />
                    <Input
                      {...register(`preferences.${idx}.value`)}
                      placeholder="Preference (e.g. first class)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => preferences.remove(idx)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => preferences.append({ key: "", value: "" })}
                >
                  <Plus className="size-4 mr-1" />
                  Add Preference
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* ---- Sensitivities ---- */}
            <AccordionItem
              value="sensitivities"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-muted-foreground" />
                  <span className="font-medium">Sensitivities</span>
                  {sensitivities.fields.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {sensitivities.fields.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Topics or situations to avoid or handle with care.
                </p>
                {sensitivities.fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2">
                    <Input
                      {...register(`sensitivities.${idx}.value`)}
                      placeholder="e.g. Recent divorce proceedings"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => sensitivities.remove(idx)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => sensitivities.append({ value: "" })}
                >
                  <Plus className="size-4 mr-1" />
                  Add Sensitivity
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* ---- Key Relationships ---- */}
            <AccordionItem
              value="key_relationships"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="font-medium">Key Relationships</span>
                  {relationships.fields.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {relationships.fields.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4">
                {relationships.fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="border rounded-md p-3 space-y-2 bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            {...register(`key_relationships.${idx}.name`)}
                            placeholder="Full name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Relationship</Label>
                          <Input
                            {...register(
                              `key_relationships.${idx}.relationship`
                            )}
                            placeholder="e.g. Business partner"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-5 shrink-0"
                        onClick={() => relationships.remove(idx)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Textarea
                        {...register(`key_relationships.${idx}.notes`)}
                        placeholder="Additional context..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    relationships.append({
                      name: "",
                      relationship: "",
                      notes: "",
                    })
                  }
                >
                  <Plus className="size-4 mr-1" />
                  Add Relationship
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* ---- Lifestyle Profile ---- */}
            <AccordionItem
              value="lifestyle_profile"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Heart className="size-4 text-muted-foreground" />
                  <span className="font-medium">Lifestyle Profile</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Travel Preferences</Label>
                    <Textarea
                      {...register("lifestyle_travel_preferences")}
                      placeholder="e.g. First class only, private aviation preferred"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Dietary Restrictions</Label>
                    <Textarea
                      {...register("lifestyle_dietary_restrictions")}
                      placeholder="e.g. Kosher, nut allergy"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Language Preference</Label>
                    <Input
                      {...register("lifestyle_language_preference")}
                      placeholder="e.g. English, Mandarin"
                    />
                  </div>
                </div>

                {/* Interests */}
                <div className="space-y-2">
                  <Label>Interests</Label>
                  <div className="flex flex-wrap gap-2">
                    {interests.fields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="flex items-center gap-1"
                      >
                        <Input
                          {...register(`lifestyle_interests.${idx}.value`)}
                          placeholder="e.g. Golf"
                          className="w-32 h-8 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => interests.remove(idx)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => interests.append({ value: "" })}
                    >
                      <Plus className="size-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* Preferred Destinations */}
                <div className="space-y-2">
                  <Label>Preferred Destinations</Label>
                  <div className="flex flex-wrap gap-2">
                    {destinations.fields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="flex items-center gap-1"
                      >
                        <Input
                          {...register(
                            `lifestyle_preferred_destinations.${idx}.value`
                          )}
                          placeholder="e.g. Monaco"
                          className="w-36 h-8 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => destinations.remove(idx)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => destinations.append({ value: "" })}
                    >
                      <Plus className="size-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </TabsContent>

      {/* ------------------------------------------------------------------ */}
      {/* Documents tab                                                        */}
      {/* ------------------------------------------------------------------ */}
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
    </Tabs>
  );
}

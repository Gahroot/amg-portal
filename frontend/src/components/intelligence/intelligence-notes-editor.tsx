"use client";

import * as React from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Section {
  key: string;
  label: string;
}

interface IntelligenceNotesEditorProps {
  initialData: Record<string, string>;
  sections: Section[];
  onSave: (data: Record<string, string>) => Promise<void>;
  isSaving?: boolean;
}

export function IntelligenceNotesEditor({
  initialData,
  sections,
  onSave,
  isSaving = false,
}: IntelligenceNotesEditorProps) {
  const [data, setData] = React.useState<Record<string, string>>(initialData);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Update local state when initialData changes
  React.useEffect(() => {
    setData(initialData);
    setHasChanges(false);
  }, [initialData]);

  const handleChange = (key: string, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(data);
      setHasChanges(false);
      toast.success("Notes saved successfully");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add and edit notes for each section. Changes are saved when you click the
          Save button.
        </p>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving || isSaving}
          size="sm"
        >
          {saving || isSaving ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.key} className="space-y-2">
            <Label htmlFor={section.key} className="text-base">
              {section.label}
            </Label>
            <Textarea
              id={section.key}
              value={data[section.key] || ""}
              onChange={(e) => handleChange(section.key, e.target.value)}
              placeholder={`Enter ${section.label.toLowerCase()} notes...`}
              rows={4}
              className="resize-none"
            />
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
          <span>You have unsaved changes</span>
        </div>
      )}
    </div>
  );
}

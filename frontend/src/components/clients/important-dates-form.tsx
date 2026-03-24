"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useUpdateClientDates } from "@/hooks/use-clients";
import type { ClientProfile, ImportantDate } from "@/types/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  CollapsibleSection,
  CollapsibleSectionGroup,
} from "@/components/ui/collapsible-section";

interface ImportantDatesFormProps {
  clientId: string;
  profile: ClientProfile;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function emptyDate(): ImportantDate {
  return { label: "", month: 1, day: 1, year: null, recurring: true };
}

export function ImportantDatesForm({ clientId, profile }: ImportantDatesFormProps) {
  const mutation = useUpdateClientDates(clientId);

  const [birthDate, setBirthDate] = React.useState<string>(
    profile.birth_date ?? ""
  );
  const [remindersEnabled, setRemindersEnabled] = React.useState<boolean>(
    profile.birthday_reminders_enabled ?? true
  );
  const [importantDates, setImportantDates] = React.useState<ImportantDate[]>(
    profile.important_dates ?? []
  );

  const handleAddDate = () => {
    setImportantDates((prev) => [...prev, emptyDate()]);
  };

  const handleRemoveDate = (index: number) => {
    setImportantDates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDateChange = <K extends keyof ImportantDate>(
    index: number,
    field: K,
    value: ImportantDate[K]
  ) => {
    setImportantDates((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const handleSave = () => {
    mutation.mutate({
      birth_date: birthDate || null,
      important_dates: importantDates.length > 0 ? importantDates : null,
      birthday_reminders_enabled: remindersEnabled,
    });
  };

  const hasBirthday = !!birthDate;

  return (
    <div className="space-y-6">
      <CollapsibleSectionGroup>
        {/* Birthday section */}
        <CollapsibleSection
          id="birthday-section"
          title="Birthday"
          description="Client's date of birth and reminder settings"
          defaultExpanded
          completionStatus={hasBirthday ? "complete" : "incomplete"}
          hasRequiredFields={false}
        >
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="birth-date">Date of Birth</Label>
              <Input
                id="birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="max-w-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="reminders-enabled"
                checked={remindersEnabled}
                onCheckedChange={setRemindersEnabled}
              />
              <Label htmlFor="reminders-enabled" className="cursor-pointer">
                Birthday reminders enabled
              </Label>
            </div>
          </div>
        </CollapsibleSection>

        {/* Important dates section */}
        <CollapsibleSection
          id="important-dates-section"
          title="Important Dates"
          description={`${importantDates.length} date${importantDates.length !== 1 ? "s" : ""} added`}
          defaultExpanded={importantDates.length > 0}
          completionStatus={importantDates.length > 0 ? "complete" : "incomplete"}
          hasRequiredFields={false}
          badge={
            importantDates.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {importantDates.length} date{importantDates.length !== 1 ? "s" : ""}
              </span>
            )
          }
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleAddDate}>
                <Plus className="h-4 w-4 mr-1" />
                Add Date
              </Button>
            </div>

            {importantDates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No important dates added yet. Click &ldquo;Add Date&rdquo; to add one.
              </p>
            )}

            {importantDates.map((entry, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="grid gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 grid gap-2">
                      <Label htmlFor={`label-${index}`}>Label</Label>
                      <Input
                        id={`label-${index}`}
                        placeholder="e.g. Wedding Anniversary"
                        value={entry.label}
                        onChange={(e) =>
                          handleDateChange(index, "label", e.target.value)
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveDate(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`month-${index}`}>Month</Label>
                      <select
                        id={`month-${index}`}
                        value={entry.month}
                        onChange={(e) =>
                          handleDateChange(index, "month", Number(e.target.value))
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      >
                        {MONTH_NAMES.map((name, i) => (
                          <option key={i + 1} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`day-${index}`}>Day</Label>
                      <Input
                        id={`day-${index}`}
                        type="number"
                        min={1}
                        max={31}
                        value={entry.day}
                        onChange={(e) =>
                          handleDateChange(index, "day", Number(e.target.value))
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`year-${index}`}>Year (optional)</Label>
                      <Input
                        id={`year-${index}`}
                        type="number"
                        min={1900}
                        max={new Date().getFullYear()}
                        placeholder="e.g. 2010"
                        value={entry.year ?? ""}
                        onChange={(e) =>
                          handleDateChange(
                            index,
                            "year",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id={`recurring-${index}`}
                      checked={entry.recurring}
                      onCheckedChange={(checked) =>
                        handleDateChange(index, "recurring", checked)
                      }
                    />
                    <Label htmlFor={`recurring-${index}`} className="cursor-pointer text-sm">
                      Recurring annually
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </CollapsibleSectionGroup>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save Dates"}
        </Button>
      </div>
    </div>
  );
}

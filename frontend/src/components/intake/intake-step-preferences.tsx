"use client";

import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection, FormSectionGroup } from "@/components/ui/form-section";
import { COMMUNICATION_PREFS } from "@/types/intake-form";
import type { IntakeFormData } from "@/lib/validations/client";

export function IntakeStepPreferences() {
  const { setValue } = useFormContext<IntakeFormData>();
  const { register } = useFormContext<IntakeFormData>();

  return (
    <FormSectionGroup className="space-y-4">
      {/* Communication Preferences - Required Section */}
      <FormSection<IntakeFormData>
        id="preferences-communication"
        title="Communication Preferences"
        description="How the client prefers to be contacted"
        defaultExpanded
        isRequired
        fields={["communication_preference"]}
        requiredFields={[]}
      >
        <div className="space-y-2">
          <Label>Preferred Communication Method</Label>
          <Select onValueChange={(value) => setValue("communication_preference", value)}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select preference" />
            </SelectTrigger>
            <SelectContent>
              {COMMUNICATION_PREFS.map((pref) => (
                <SelectItem key={pref.value} value={pref.value}>
                  {pref.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormSection>

      {/* Additional Notes - Optional Section */}
      <FormSection<IntakeFormData>
        id="preferences-notes"
        title="Additional Notes"
        description="Sensitivities and special instructions"
        defaultExpanded={false}
        fields={["sensitivities", "special_instructions"]}
        requiredFields={[]}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="sensitivities">Sensitivities</Label>
            <Textarea
              id="sensitivities"
              {...register("sensitivities")}
              placeholder="Any sensitivities to be aware of (e.g., privacy concerns, specific handling requirements)"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Information that requires special handling or consideration
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_instructions">Special Instructions</Label>
            <Textarea
              id="special_instructions"
              {...register("special_instructions")}
              placeholder="Any special instructions for working with this client"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              General instructions for the team when working with this client
            </p>
          </div>
        </div>
      </FormSection>
    </FormSectionGroup>
  );
}

"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection, FormSectionGroup } from "@/components/ui/form-section";
import { ENTITY_TYPES } from "@/types/intake-form";
import type { IntakeFormData } from "@/lib/validations/client";

export function IntakeStepIdentity() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<IntakeFormData>();

  return (
    <FormSectionGroup className="space-y-4">
      {/* Required Identity Information */}
      <FormSection<IntakeFormData>
        id="identity-required"
        title="Identity Information"
        description="Basic identifying information"
        defaultExpanded
        isRequired
        fields={["legal_name", "display_name"]}
        requiredFields={["legal_name"]}
        autoExpandOnError
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legal_name">
              Legal Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="legal_name"
              {...register("legal_name")}
              placeholder="Full legal name"
            />
            {errors.legal_name && (
              <p className="text-sm text-destructive">{errors.legal_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              {...register("display_name")}
              placeholder="Name to use in communications"
            />
            <p className="text-xs text-muted-foreground">
              If different from legal name
            </p>
          </div>
        </div>
      </FormSection>

      {/* Optional Entity Details */}
      <FormSection<IntakeFormData>
        id="identity-entity"
        title="Entity Details"
        description="For corporate clients and entities"
        defaultExpanded={false}
        fields={["entity_type", "jurisdiction", "tax_id"]}
        requiredFields={[]}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select onValueChange={(value) => setValue("entity_type", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jurisdiction">Jurisdiction</Label>
            <Input
              id="jurisdiction"
              {...register("jurisdiction")}
              placeholder="e.g., United States, United Kingdom"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tax_id">Tax ID / Registration Number</Label>
            <Input
              id="tax_id"
              {...register("tax_id")}
              placeholder="Tax identification number"
            />
            <p className="text-xs text-muted-foreground">
              For entities, enter the registration number
            </p>
          </div>
        </div>
      </FormSection>
    </FormSectionGroup>
  );
}

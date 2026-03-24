"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSection, FormSectionGroup } from "@/components/ui/form-section";
import type { IntakeFormData } from "@/lib/validations/client";

export function IntakeStepContact() {
  const {
    register,
    formState: { errors },
  } = useFormContext<IntakeFormData>();

  return (
    <FormSectionGroup className="space-y-4">
      {/* Primary Contact - Required */}
      <FormSection<IntakeFormData>
        id="contact-primary"
        title="Primary Contact"
        description="Main contact information"
        defaultExpanded
        isRequired
        fields={["primary_email", "phone"]}
        requiredFields={["primary_email"]}
        autoExpandOnError
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary_email">
              Primary Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="primary_email"
              type="email"
              {...register("primary_email")}
              placeholder="primary@example.com"
            />
            {errors.primary_email && (
              <p className="text-sm text-destructive">{errors.primary_email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              {...register("phone")}
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>
      </FormSection>

      {/* Additional Contact Info - Optional */}
      <FormSection<IntakeFormData>
        id="contact-additional"
        title="Additional Information"
        description="Secondary email and mailing address"
        defaultExpanded={false}
        fields={["secondary_email", "address"]}
        requiredFields={[]}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="secondary_email">Secondary Email</Label>
            <Input
              id="secondary_email"
              type="email"
              {...register("secondary_email")}
              placeholder="secondary@example.com"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              {...register("address")}
              placeholder="Full mailing address"
              rows={3}
            />
          </div>
        </div>
      </FormSection>
    </FormSectionGroup>
  );
}

"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeFormData } from "@/types/intake-form";

export function IntakeStepContact() {
  const {
    register,
    formState: { errors },
  } = useFormContext<IntakeFormData>();

  return (
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
        <Label htmlFor="secondary_email">Secondary Email</Label>
        <Input
          id="secondary_email"
          type="email"
          {...register("secondary_email")}
          placeholder="secondary@example.com"
        />
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
  );
}

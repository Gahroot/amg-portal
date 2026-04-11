"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FAMILY_RELATIONSHIP_TYPES } from "@/types/intake-form";
import type { FamilyMemberCreate, FamilyRelationshipType } from "@/types/family-member";

const familyMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship_type: z.string().min(1, "Relationship is required"),
  date_of_birth: z.string().optional(),
  occupation: z.string().optional(),
  notes: z.string().optional(),
  is_primary_contact: z.boolean().optional(),
});

type FormData = z.infer<typeof familyMemberSchema>;

interface FamilyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FamilyMemberCreate) => void;
  initialData?: FamilyMemberCreate;
  isEditing?: boolean;
}

export function FamilyMemberDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isEditing = false,
}: FamilyMemberDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(familyMemberSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      relationship_type: initialData?.relationship_type ?? "",
      date_of_birth: initialData?.date_of_birth ?? undefined,
      occupation: initialData?.occupation ?? undefined,
      notes: initialData?.notes ?? undefined,
      is_primary_contact: initialData?.is_primary_contact ?? false,
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name || "",
        relationship_type: initialData?.relationship_type || "",
        date_of_birth: initialData?.date_of_birth || "",
        occupation: initialData?.occupation || "",
        notes: initialData?.notes || "",
        is_primary_contact: initialData?.is_primary_contact || false,
      });
    }
  }, [open, initialData, reset]);

  const isPrimaryContact = watch("is_primary_contact");

  const handleFormSubmit = (data: FormData) => {
    onSubmit({
      name: data.name,
      relationship_type: data.relationship_type as FamilyRelationshipType,
      date_of_birth: data.date_of_birth,
      occupation: data.occupation,
      notes: data.notes,
      is_primary_contact: data.is_primary_contact ?? false,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Family Member" : "Add Family Member"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit as (data: FormData) => void)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Full name"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Relationship <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch("relationship_type")}
                onValueChange={(value) => setValue("relationship_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_RELATIONSHIP_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.relationship_type && (
                <p className="text-sm text-destructive">
                  {errors.relationship_type.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                {...register("date_of_birth")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                {...register("occupation")}
                placeholder="Profession or role"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional notes about this person"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_primary_contact"
              checked={isPrimaryContact}
              onCheckedChange={(checked) =>
                setValue("is_primary_contact", checked === true)
              }
            />
            <Label htmlFor="is_primary_contact" className="font-normal">
              Mark as primary contact
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

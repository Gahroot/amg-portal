"use client";

import * as React from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FamilyMemberDialog } from "./family-member-dialog";
import { FamilyMemberList } from "./family-member-list";
import type { FamilyMemberCreate, FamilyMember } from "@/types/family-member";

interface IntakeStepFamilyProps {
  initialMembers?: FamilyMember[];
}

export function IntakeStepFamily({ initialMembers = [] }: IntakeStepFamilyProps) {
  const [familyMembers, setFamilyMembers] = React.useState<FamilyMemberCreate[]>(
    initialMembers.map((m) => ({
      name: m.name,
      relationship_type: m.relationship_type,
      date_of_birth: m.date_of_birth || undefined,
      occupation: m.occupation || undefined,
      notes: m.notes || undefined,
      is_primary_contact: m.is_primary_contact,
    }))
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);

  const handleAddMember = (data: FamilyMemberCreate) => {
    if (editingIndex !== null) {
      const updated = [...familyMembers];
      updated[editingIndex] = data;
      setFamilyMembers(updated);
      setEditingIndex(null);
    } else {
      setFamilyMembers([...familyMembers, data]);
    }
    setDialogOpen(false);
  };

  const handleEditMember = (index: number) => {
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleDeleteMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  const editingMember =
    editingIndex !== null ? familyMembers[editingIndex] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Family Members</h3>
          <p className="text-sm text-muted-foreground">
            Add family members and key contacts associated with this client
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-2" />
          Add Member
        </Button>
      </div>

      {familyMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">No family members added yet</p>
          <p className="text-sm text-muted-foreground">
            Add family members to keep track of important contacts
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4 mr-2" />
            Add First Member
          </Button>
        </div>
      ) : (
        <FamilyMemberList
          members={familyMembers}
          onEdit={handleEditMember}
          onDelete={handleDeleteMember}
        />
      )}

      <FamilyMemberDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingIndex(null);
        }}
        onSubmit={handleAddMember}
        initialData={editingMember}
        isEditing={editingIndex !== null}
      />
    </div>
  );
}

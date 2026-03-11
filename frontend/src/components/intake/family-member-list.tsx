"use client";

import { Pencil, Trash2, Star, Calendar, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FAMILY_RELATIONSHIP_TYPES } from "@/types/intake-form";
import type { FamilyMemberCreate } from "@/types/family-member";

interface FamilyMemberListProps {
  members: FamilyMemberCreate[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  readOnly?: boolean;
}

export function FamilyMemberList({
  members,
  onEdit,
  onDelete,
  readOnly = false,
}: FamilyMemberListProps) {
  const getRelationshipLabel = (value: string) => {
    const type = FAMILY_RELATIONSHIP_TYPES.find((t) => t.value === value);
    return type?.label || value;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  };

  const calculateAge = (date: string | undefined) => {
    if (!date) return null;
    const dob = new Date(date);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="space-y-3">
      {members.map((member, index) => (
        <div
          key={index}
          className="flex items-start justify-between rounded-lg border p-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{member.name}</h4>
              <Badge variant="secondary">
                {getRelationshipLabel(member.relationship_type)}
              </Badge>
              {member.is_primary_contact && (
                <Badge variant="default" className="gap-1">
                  <Star className="size-3" />
                  Primary
                </Badge>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {member.date_of_birth && (
                <div className="flex items-center gap-1">
                  <Calendar className="size-4" />
                  {formatDate(member.date_of_birth)}
                  <span className="text-xs">
                    ({calculateAge(member.date_of_birth)} years)
                  </span>
                </div>
              )}
              {member.occupation && (
                <div className="flex items-center gap-1">
                  <Briefcase className="size-4" />
                  {member.occupation}
                </div>
              )}
            </div>

            {member.notes && (
              <p className="mt-2 text-sm text-muted-foreground">{member.notes}</p>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(index)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(index)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

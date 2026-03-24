"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink, Building2, UserCheck, Merge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

export interface BaseDuplicateMatch {
  similarity_score: number;
  match_reasons: string[];
}

export interface ClientDuplicateMatch extends BaseDuplicateMatch {
  client_id: string;
  legal_name: string;
  display_name: string | null;
  primary_email: string;
  phone: string | null;
}

export interface PartnerDuplicateMatch extends BaseDuplicateMatch {
  partner_id: string;
  firm_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
}

export type EntityType = "client" | "partner";

// ---------------------------------------------------------------------------
// Score label helper
// ---------------------------------------------------------------------------

function scoreLabel(
  score: number
): { label: string; variant: "destructive" | "outline" | "secondary" } {
  if (score >= 0.95) return { label: "Very likely duplicate", variant: "destructive" };
  if (score >= 0.85) return { label: "Likely duplicate", variant: "destructive" };
  if (score >= 0.75) return { label: "Possible duplicate", variant: "outline" };
  return { label: "Low similarity", variant: "secondary" };
}

// ---------------------------------------------------------------------------
// Client match card
// ---------------------------------------------------------------------------

interface ClientMatchCardProps {
  match: ClientDuplicateMatch;
  showMergeOption?: boolean;
  isSelectedForMerge?: boolean;
  onToggleMerge?: () => void;
}

function ClientMatchCard({
  match,
  showMergeOption,
  isSelectedForMerge,
  onToggleMerge,
}: ClientMatchCardProps) {
  const { label, variant } = scoreLabel(match.similarity_score);

  return (
    <div
      className={`rounded-lg border bg-card p-4 shadow-sm ${
        isSelectedForMerge ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{match.legal_name}</span>
            {match.display_name && match.display_name !== match.legal_name && (
              <span className="truncate text-sm text-muted-foreground">
                ({match.display_name})
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{match.primary_email}</span>
            {match.phone && <span>{match.phone}</span>}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {match.match_reasons.map((reason) => (
              <Badge key={reason} variant="secondary" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={variant} className="whitespace-nowrap text-xs">
            {label}
          </Badge>
          <div className="flex items-center gap-2">
            {showMergeOption && (
              <Button
                variant={isSelectedForMerge ? "default" : "outline"}
                size="sm"
                onClick={onToggleMerge}
              >
                <Merge className="mr-1 h-3 w-3" />
                {isSelectedForMerge ? "Selected" : "Merge"}
              </Button>
            )}
            <a
              href={`/clients/${match.client_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partner match card
// ---------------------------------------------------------------------------

interface PartnerMatchCardProps {
  match: PartnerDuplicateMatch;
  showMergeOption?: boolean;
  isSelectedForMerge?: boolean;
  onToggleMerge?: () => void;
}

function PartnerMatchCard({
  match,
  showMergeOption,
  isSelectedForMerge,
  onToggleMerge,
}: PartnerMatchCardProps) {
  const { label, variant } = scoreLabel(match.similarity_score);

  return (
    <div
      className={`rounded-lg border bg-card p-4 shadow-sm ${
        isSelectedForMerge ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{match.firm_name}</span>
          </div>

          <div className="mt-1 text-sm text-muted-foreground">
            Contact: {match.contact_name}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{match.contact_email}</span>
            {match.contact_phone && <span>{match.contact_phone}</span>}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {match.match_reasons.map((reason) => (
              <Badge key={reason} variant="secondary" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={variant} className="whitespace-nowrap text-xs">
            {label}
          </Badge>
          <div className="flex items-center gap-2">
            {showMergeOption && (
              <Button
                variant={isSelectedForMerge ? "default" : "outline"}
                size="sm"
                onClick={onToggleMerge}
              >
                <Merge className="mr-1 h-3 w-3" />
                {isSelectedForMerge ? "Selected" : "Merge"}
              </Button>
            )}
            <a
              href={`/partners/${match.partner_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merge field selector
// ---------------------------------------------------------------------------

interface FieldSelectorProps {
  fields: { key: string; label: string; newValue?: string; existingValue?: string }[];
  selectedFields: Record<string, "new" | "existing">;
  onFieldChange: (field: string, value: "new" | "existing") => void;
}

function FieldSelector({ fields, selectedFields, onFieldChange }: FieldSelectorProps) {
  if (fields.length === 0) return null;

  return (
    <div className="mt-4 space-y-3 rounded-lg border p-4">
      <h4 className="font-medium text-sm">Choose which values to keep:</h4>
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{field.label}</Label>
          <div className="flex items-center gap-2">
            <Select
              value={selectedFields[field.key] || "new"}
              onValueChange={(value) =>
                onFieldChange(field.key, value as "new" | "existing")
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  {field.newValue || "(empty)"}
                  <span className="ml-2 text-xs text-muted-foreground">(new)</span>
                </SelectItem>
                <SelectItem value="existing">
                  {field.existingValue || "(empty)"}
                  <span className="ml-2 text-xs text-muted-foreground">(existing)</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog props
// ---------------------------------------------------------------------------

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  duplicates: ClientDuplicateMatch[] | PartnerDuplicateMatch[];
  /** Called when the user chooses to proceed with creating the new entity anyway. */
  onCreateAnyway: () => void;
  /** Called when the user chooses to merge with an existing entity. */
  onMerge?: (duplicateId: string, fieldSelections: Record<string, "new" | "existing">) => void;
  /** Whether to show merge option. */
  showMergeOption?: boolean;
}

// ---------------------------------------------------------------------------
// Main dialog component
// ---------------------------------------------------------------------------

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  entityType,
  duplicates,
  onCreateAnyway,
  onMerge,
  showMergeOption = false,
}: DuplicateWarningDialogProps) {
  const [selectedForMerge, setSelectedForMerge] = React.useState<string | null>(null);
  const [fieldSelections, setFieldSelections] = React.useState<
    Record<string, "new" | "existing">
  >({});

  const entityLabel = entityType === "client" ? "client" : "partner";
  const entityLabelPlural = entityType === "client" ? "clients" : "partners";

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedForMerge(null);
      setFieldSelections({});
    }
  }, [open]);

  const handleCreateAnyway = () => {
    onOpenChange(false);
    onCreateAnyway();
  };

  const handleMerge = () => {
    if (selectedForMerge && onMerge) {
      onMerge(selectedForMerge, fieldSelections);
      onOpenChange(false);
    }
  };

  const toggleMergeSelection = (id: string) => {
    if (selectedForMerge === id) {
      setSelectedForMerge(null);
      setFieldSelections({});
    } else {
      setSelectedForMerge(id);
      // Initialize field selections to prefer new values by default
      setFieldSelections({});
    }
  };

  // Get the selected duplicate for merge field selection
  const selectedDuplicate =
    selectedForMerge && duplicates.length > 0
      ? duplicates.find((d) =>
          entityType === "client"
            ? (d as ClientDuplicateMatch).client_id === selectedForMerge
            : (d as PartnerDuplicateMatch).partner_id === selectedForMerge
        )
      : null;

  // Build field options for merge selector (simplified - in a real implementation
  // you'd pass the new form data to compare)
  const getMergeFields = () => {
    if (!selectedDuplicate) return [];

    if (entityType === "client") {
      const client = selectedDuplicate as ClientDuplicateMatch;
      return [
        { key: "legal_name", label: "Legal Name", existingValue: client.legal_name },
        {
          key: "primary_email",
          label: "Primary Email",
          existingValue: client.primary_email,
        },
        { key: "phone", label: "Phone", existingValue: client.phone || undefined },
      ];
    } else {
      const partner = selectedDuplicate as PartnerDuplicateMatch;
      return [
        { key: "firm_name", label: "Firm Name", existingValue: partner.firm_name },
        {
          key: "contact_name",
          label: "Contact Name",
          existingValue: partner.contact_name,
        },
        {
          key: "contact_email",
          label: "Contact Email",
          existingValue: partner.contact_email,
        },
        {
          key: "contact_phone",
          label: "Contact Phone",
          existingValue: partner.contact_phone || undefined,
        },
      ];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Potential duplicate{duplicates.length > 1 ? "s" : ""} detected
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                {duplicates.length === 1
                  ? `An existing ${entityLabel} profile may match the details you entered.`
                  : `${duplicates.length} existing ${entityLabelPlural} may match the details you entered.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 max-h-80 space-y-3 overflow-y-auto pr-1">
          {entityType === "client"
            ? (duplicates as ClientDuplicateMatch[]).map((match) => (
                <ClientMatchCard
                  key={match.client_id}
                  match={match}
                  showMergeOption={showMergeOption}
                  isSelectedForMerge={selectedForMerge === match.client_id}
                  onToggleMerge={() => toggleMergeSelection(match.client_id)}
                />
              ))
            : (duplicates as PartnerDuplicateMatch[]).map((match) => (
                <PartnerMatchCard
                  key={match.partner_id}
                  match={match}
                  showMergeOption={showMergeOption}
                  isSelectedForMerge={selectedForMerge === match.partner_id}
                  onToggleMerge={() => toggleMergeSelection(match.partner_id)}
                />
              ))}
        </div>

        {showMergeOption && selectedForMerge && (
          <FieldSelector
            fields={getMergeFields()}
            selectedFields={fieldSelections}
            onFieldChange={(field, value) =>
              setFieldSelections((prev) => ({ ...prev, [field]: value }))
            }
          />
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Go back and review
          </Button>
          {showMergeOption && onMerge && selectedForMerge && (
            <Button variant="default" onClick={handleMerge}>
              <Merge className="mr-2 h-4 w-4" />
              Merge into existing
            </Button>
          )}
          <Button variant="destructive" onClick={handleCreateAnyway}>
            Create new {entityLabel} anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

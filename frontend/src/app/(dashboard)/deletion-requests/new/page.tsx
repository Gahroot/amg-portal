"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useCreateDeletionRequest } from "@/hooks/use-deletion-requests";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Must match backend _ENTITY_REGISTRY
const ENTITY_TYPES = [
  { value: "clients", label: "Clients" },
  { value: "client_profiles", label: "Client Profiles" },
  { value: "programs", label: "Programs" },
  { value: "partners", label: "Partners" },
  { value: "deliverables", label: "Deliverables" },
  { value: "documents", label: "Documents" },
  { value: "users", label: "Users" },
  { value: "tasks", label: "Tasks" },
  { value: "escalations", label: "Escalations" },
  { value: "communications", label: "Communications" },
] as const;

interface FormState {
  entity_type: string;
  entity_id: string;
  reason: string;
}

interface FormErrors {
  entity_type?: string;
  entity_id?: string;
  reason?: string;
  acknowledged?: string;
}

function validate(state: FormState, acknowledged: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!state.entity_type) errors.entity_type = "Please select an entity type.";
  if (!state.entity_id.trim()) {
    errors.entity_id = "Entity ID is required.";
  } else {
    // Basic UUID format check
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(state.entity_id.trim())) {
      errors.entity_id = "Entity ID must be a valid UUID.";
    }
  }
  if (state.reason.trim().length < 10) {
    errors.reason = "Reason must be at least 10 characters.";
  }
  if (!acknowledged) {
    errors.acknowledged =
      "You must acknowledge that this action requires a second authorizer.";
  }
  return errors;
}

export default function NewDeletionRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const createMutation = useCreateDeletionRequest();

  const [form, setForm] = useState<FormState>({
    entity_type: "",
    entity_id: "",
    reason: "",
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Any internal user can submit a request (require_internal on backend)
  const canAccess =
    user &&
    ["managing_director", "finance_compliance", "relationship_manager", "coordinator"].includes(
      user.role,
    );

  if (!canAccess) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to submit deletion requests.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const validationErrors = validate(form, acknowledged);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    try {
      await createMutation.mutateAsync({
        entity_type: form.entity_type,
        entity_id: form.entity_id.trim(),
        reason: form.reason.trim(),
      });
      router.push("/deletion-requests");
    } catch {
      // Error toast is handled by the hook
    }
  };

  const handleChange =
    (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (submitted) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            New Deletion Request
          </h1>
          <p className="text-sm text-muted-foreground">
            Submit a request to permanently delete an entity. A second Managing
            Director must authorize before any deletion is executed.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertTitle>Two-Person Authorization Required</AlertTitle>
          <AlertDescription>
            Pursuant to AMG governance policy, no data may be permanently erased
            without a second authorized Managing Director approving this request.
            All deletion events are logged in the compliance audit trail.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Request Details</CardTitle>
            <CardDescription>
              Provide accurate information. The target entity must exist and
              there must be no other pending deletion request for it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Entity Type */}
              <div className="space-y-2">
                <Label htmlFor="entity-type">Entity Type</Label>
                <Select
                  value={form.entity_type}
                  onValueChange={(value) => {
                    setForm((prev) => ({ ...prev, entity_type: value }));
                    if (submitted) {
                      setErrors((prev) => ({ ...prev, entity_type: undefined }));
                    }
                  }}
                >
                  <SelectTrigger id="entity-type">
                    <SelectValue placeholder="Select the type of record to delete" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        {et.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.entity_type && (
                  <p className="text-sm text-destructive">{errors.entity_type}</p>
                )}
              </div>

              {/* Entity ID */}
              <div className="space-y-2">
                <Label htmlFor="entity-id">Entity ID (UUID)</Label>
                <Input
                  id="entity-id"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={form.entity_id}
                  onChange={handleChange("entity_id")}
                  className="font-mono text-sm"
                />
                {errors.entity_id && (
                  <p className="text-sm text-destructive">{errors.entity_id}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Copy the UUID from the entity detail page.
                </p>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Deletion</Label>
                <Textarea
                  id="reason"
                  placeholder="Describe why this record must be deleted. Include any regulatory, legal, or operational justification (minimum 10 characters)."
                  value={form.reason}
                  onChange={handleChange("reason")}
                  rows={4}
                />
                <div className="flex justify-between">
                  {errors.reason ? (
                    <p className="text-sm text-destructive">{errors.reason}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {form.reason.length} chars
                  </p>
                </div>
              </div>

              {/* Acknowledgment */}
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="acknowledged"
                    checked={acknowledged}
                    onCheckedChange={(checked) => {
                      setAcknowledged(!!checked);
                      if (submitted) {
                        setErrors((prev) => ({
                          ...prev,
                          acknowledged: undefined,
                        }));
                      }
                    }}
                  />
                  <Label
                    htmlFor="acknowledged"
                    className="cursor-pointer leading-relaxed"
                  >
                    I understand that this deletion request will require
                    authorization from a second Managing Director before it is
                    executed. I confirm the entity ID and reason are accurate,
                    and I acknowledge that this action creates a permanent audit
                    record.
                  </Label>
                </div>
                {errors.acknowledged && (
                  <p className="text-sm text-destructive">
                    {errors.acknowledged}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? "Submitting…"
                    : "Submit Deletion Request"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/deletion-requests")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

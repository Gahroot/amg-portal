"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updatePartner,
  provisionPartner,
} from "@/lib/api/partners";
import type { PartnerProfile, PartnerUpdateData } from "@/types/partner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { BookmarkButton } from "@/components/ui/bookmark-button";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
  draft: "outline",
};

interface PartnerProfileHeaderProps {
  partner: PartnerProfile;
  partnerId: string;
  isMD: boolean;
  onIssueNotice: () => void;
  error: string | null;
  onClearError: () => void;
}

export function PartnerProfileHeader({
  partner,
  partnerId,
  isMD,
  onIssueNotice,
  error,
  onClearError,
}: PartnerProfileHeaderProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<PartnerUpdateData>({});
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionPassword, setProvisionPassword] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (data: PartnerUpdateData) => updatePartner(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", partnerId] });
      setEditing(false);
      setMutationError(null);
      onClearError();
    },
    onError: () => {
      setMutationError("Failed to update partner.");
    },
  });

  const provisionMutation = useMutation({
    mutationFn: () =>
      provisionPartner(partnerId, {
        password: provisionPassword || undefined,
        send_welcome_email: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", partnerId] });
      setProvisionOpen(false);
      setProvisionPassword("");
      setMutationError(null);
    },
    onError: () => {
      setMutationError("Failed to provision partner user.");
    },
  });

  const startEditing = () => {
    setEditData({
      firm_name: partner.firm_name,
      contact_name: partner.contact_name,
      contact_email: partner.contact_email,
      contact_phone: partner.contact_phone || undefined,
      capabilities: partner.capabilities,
      geographies: partner.geographies,
      availability_status: partner.availability_status,
      notes: partner.notes || undefined,
      status: partner.status,
    });
    setEditing(true);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {partner.firm_name}
          </h1>
          <BookmarkButton
            entityType="partner"
            entityId={partnerId}
            entityTitle={partner.firm_name}
            entitySubtitle={partner.contact_name}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[partner.status] ?? "outline"}>
            {partner.status.replace(/_/g, " ")}
          </Badge>
          {partner.is_on_probation && (
            <Badge
              variant="outline"
              className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 gap-1"
            >
              <ShieldAlert className="h-3 w-3" />
              Probationary
            </Badge>
          )}
          {!editing && (
            <Button variant="outline" onClick={startEditing}>
              Edit
            </Button>
          )}
          {isMD && (
            <Button
              variant="destructive"
              onClick={onIssueNotice}
            >
              Issue Performance Notice
            </Button>
          )}
          {!partner.user_id && (
            <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
              <DialogTrigger asChild>
                <Button>Provision User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Provision Partner User</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Password (optional, auto-generated if empty)</Label>
                    <Input
                      type="password"
                      value={provisionPassword}
                      onChange={(e) => setProvisionPassword(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => provisionMutation.mutate()}
                    disabled={provisionMutation.isPending}
                  >
                    {provisionMutation.isPending
                      ? "Provisioning..."
                      : "Provision"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {(error ?? mutationError) && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? mutationError}</AlertDescription>
        </Alert>
      )}

      {partner.is_on_probation && (
        <Alert className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 dark:text-amber-300">Probationary Partner</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            This partner is under enhanced oversight for their first three engagements.{" "}
            <span className="font-semibold">
              {partner.completed_assignments} of 3 qualifying engagements completed.
            </span>{" "}
            Apply additional review steps to all deliverables and communications.
          </AlertDescription>
        </Alert>
      )}

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Edit Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Firm Name</Label>
              <Input
                value={editData.firm_name ?? ""}
                onChange={(e) =>
                  setEditData((d) => ({
                    ...d,
                    firm_name: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={editData.contact_name ?? ""}
                onChange={(e) =>
                  setEditData((d) => ({
                    ...d,
                    contact_name: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                value={editData.contact_email ?? ""}
                onChange={(e) =>
                  setEditData((d) => ({
                    ...d,
                    contact_email: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={editData.contact_phone ?? ""}
                onChange={(e) =>
                  setEditData((d) => ({
                    ...d,
                    contact_phone: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Availability</Label>
              <Select
                value={editData.availability_status ?? undefined}
                onValueChange={(value) =>
                  setEditData((d) => ({
                    ...d,
                    availability_status: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="unavailable">
                    Unavailable
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editData.status ?? undefined}
                onValueChange={(value) =>
                  setEditData((d) => ({ ...d, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editData.notes ?? ""}
                onChange={(e) =>
                  setEditData((d) => ({ ...d, notes: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => updateMutation.mutate(editData)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Contact Name
                </p>
                <p className="font-medium">{partner.contact_name}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{partner.contact_email}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">
                  {partner.contact_phone ?? "-"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Availability
                </p>
                <Badge
                  variant={
                    partner.availability_status === "available"
                      ? "default"
                      : partner.availability_status === "busy"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {partner.availability_status.replace(/_/g, " ")}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Rating</p>
                <p className="font-medium">
                  {partner.performance_rating != null
                    ? Number(partner.performance_rating).toFixed(1)
                    : "Not rated"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Assignments
                </p>
                <p className="font-medium">
                  {partner.completed_assignments} /{" "}
                  {partner.total_assignments} completed
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Capabilities
              </p>
              <div className="flex flex-wrap gap-1">
                {partner.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary">
                    {cap}
                  </Badge>
                ))}
                {partner.capabilities.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    None
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Geographies
              </p>
              <div className="flex flex-wrap gap-1">
                {partner.geographies.map((geo) => (
                  <Badge key={geo} variant="outline">
                    {geo}
                  </Badge>
                ))}
                {partner.geographies.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    None
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {partner.notes && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm mt-1">{partner.notes}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}

"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPartner,
  updatePartner,
  provisionPartner,
  uploadComplianceDoc,
} from "@/lib/api/partners";
import type { PartnerUpdateData } from "@/lib/api/partners";
import { listAssignments } from "@/lib/api/assignments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
  draft: "outline",
};

const ASSIGNMENT_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  dispatched: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

export default function PartnerDetailPage() {
  const params = useParams();
  const partnerId = params.id as string;
  const queryClient = useQueryClient();

  const [editing, setEditing] = React.useState(false);
  const [editData, setEditData] = React.useState<PartnerUpdateData>({});
  const [provisionOpen, setProvisionOpen] = React.useState(false);
  const [provisionPassword, setProvisionPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partners", partnerId],
    queryFn: () => getPartner(partnerId),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments", { partner_id: partnerId }],
    queryFn: () => listAssignments({ partner_id: partnerId }),
    enabled: !!partnerId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: PartnerUpdateData) => updatePartner(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", partnerId] });
      setEditing(false);
      setError(null);
    },
    onError: () => {
      setError("Failed to update partner.");
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
    },
    onError: () => {
      setError("Failed to provision partner user.");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadComplianceDoc(partnerId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", partnerId] });
    },
    onError: () => {
      setError("Failed to upload compliance document.");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const startEditing = () => {
    if (!partner) return;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">Loading partner...</p>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Partner not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {partner.firm_name}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[partner.status] ?? "outline"}>
              {partner.status.replace(/_/g, " ")}
            </Badge>
            {!editing && (
              <Button variant="outline" onClick={startEditing}>
                Edit
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
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
                      value={editData.availability_status}
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
                      value={editData.status}
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
                          ? partner.performance_rating.toFixed(1)
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
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentsData?.assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/assignments/${assignment.id}`}
                          className="hover:underline"
                        >
                          {assignment.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {assignment.program_title ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ASSIGNMENT_STATUS_VARIANT[assignment.status] ??
                            "outline"
                          }
                        >
                          {assignment.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignment.due_date
                          ? new Date(
                              assignment.due_date
                            ).toLocaleDateString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!assignmentsData ||
                    assignmentsData.assignments.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No assignments found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">
                  Compliance Document
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Verified Status
                  </p>
                  <Badge
                    variant={
                      partner.compliance_verified ? "default" : "secondary"
                    }
                  >
                    {partner.compliance_verified ? "Verified" : "Not Verified"}
                  </Badge>
                </div>

                {partner.compliance_doc_url && (
                  <div>
                    <p className="text-sm text-muted-foreground">Document</p>
                    <a
                      href={partner.compliance_doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View Document
                    </a>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Upload Compliance Document</Label>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadMutation.isPending}
                  />
                  {uploadMutation.isPending && (
                    <p className="text-sm text-muted-foreground">
                      Uploading...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

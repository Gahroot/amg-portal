"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPartner, uploadComplianceDoc } from "@/lib/api/partners";
import { listAssignments } from "@/lib/api/assignments";
import { listPartnerNotices } from "@/lib/api/performance-notices";
import { useAuth } from "@/providers/auth-provider";
import { PerformanceNoticeDialog } from "@/components/partners/performance-notice-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentList } from "@/components/documents/document-list";
import { CapacityHeatmap } from "@/components/partners/capacity-heatmap";
import { PartnerProfileHeader } from "./_components/partner-profile-header";
import { PartnerCapabilitiesMatrix } from "./_components/partner-capabilities-matrix";
import { PartnerScorecard } from "./_components/partner-scorecard";
import {
  AssignmentHistoryTable,
  PerformanceNoticesSection,
  PartnerTrends,
} from "./_components/partner-assignment-history";

export default function PartnerDetailPage() {
  const params = useParams();
  const partnerId = params.id as string;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMD = user?.role === "managing_director";

  const [error, setError] = useState<string | null>(null);
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partners", partnerId],
    queryFn: () => getPartner(partnerId),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments", { partner_id: partnerId }],
    queryFn: () => listAssignments({ partner_id: partnerId }),
    enabled: !!partnerId,
  });

  const { data: noticesData } = useQuery({
    queryKey: ["performance-notices", partnerId],
    queryFn: () => listPartnerNotices(partnerId),
    enabled: !!partnerId,
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

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">Loading partner...</p>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Partner not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
            <TabsTrigger value="notices" className="relative">
              Performance Notices
              {noticesData && noticesData.unacknowledged_count > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                  {noticesData.unacknowledged_count}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="trends">Performance Trends</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <PartnerProfileHeader
              partner={partner}
              partnerId={partnerId}
              isMD={isMD}
              onIssueNotice={() => setNoticeDialogOpen(true)}
              error={error}
              onClearError={() => setError(null)}
            />
          </TabsContent>

          <TabsContent value="capabilities" className="space-y-4">
            <PartnerCapabilitiesMatrix partnerId={partnerId} />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <AssignmentHistoryTable
              assignments={assignmentsData?.assignments ?? []}
            />
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

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <DocumentList entityType="partner" entityId={partnerId} />
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <PartnerScorecard
              partnerId={partnerId}
              partnerName={partner.firm_name}
              isMD={isMD}
            />
          </TabsContent>

          <TabsContent value="notices" className="space-y-4">
            <PerformanceNoticesSection
              notices={noticesData?.notices ?? []}
              total={noticesData?.total ?? 0}
              unacknowledgedCount={noticesData?.unacknowledged_count ?? 0}
              isMD={isMD}
              onIssueNotice={() => setNoticeDialogOpen(true)}
            />
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <PartnerTrends partnerId={partnerId} />
          </TabsContent>

          <TabsContent value="availability" className="space-y-4">
            <CapacityHeatmap partnerId={partnerId} />
          </TabsContent>
        </Tabs>
      </div>

      <PerformanceNoticeDialog
        open={noticeDialogOpen}
        onOpenChange={setNoticeDialogOpen}
        partnerId={partnerId}
        partnerName={partner.firm_name}
        programs={
          assignmentsData?.assignments
            .filter((a) => a.program_id && a.program_title)
            .map((a) => ({
              program_id: a.program_id,
              program_title: a.program_title,
            })) ?? []
        }
      />
    </div>
  );
}

"use client";

import { usePortalProfile } from "@/hooks/use-clients";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocumentList } from "@/components/documents/document-list";
import { EnvelopeList } from "@/components/documents/envelope-list";
import { FileText, FileSignature } from "lucide-react";

export default function PortalDocumentsPage() {
  const { data: profile, isLoading } = usePortalProfile();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Documents
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your files and sign documents
        </p>
      </div>

      <Tabs defaultValue="envelopes">
        <TabsList>
          <TabsTrigger value="envelopes" className="gap-1.5">
            <FileSignature className="size-4" />
            Signing
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5">
            <FileText className="size-4" />
            Files
          </TabsTrigger>
        </TabsList>

        <TabsContent value="envelopes" className="mt-4">
          <EnvelopeList />
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          {profile ? (
            <DocumentList
              entityType="client"
              entityId={profile.id}
              showUpload={false}
              showDelete={false}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Profile not available.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

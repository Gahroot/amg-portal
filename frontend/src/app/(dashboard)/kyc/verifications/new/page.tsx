"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadZone } from "@/components/documents/file-upload-zone";
import { useClientProfiles } from "@/hooks/use-clients";
import { useUploadKYCDocument } from "@/hooks/use-kyc-documents";

const KYC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "proof_of_address", label: "Proof of Address" },
  { value: "tax_id", label: "Tax ID" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "source_of_wealth", label: "Source of Wealth" },
  { value: "other", label: "Other" },
];

export default function NewKYCDocumentPage() {
  const router = useRouter();

  const [clientId, setClientId] = useState("");
  const [docType, setDocType] = useState("passport");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: clientsData, isLoading: clientsLoading } = useClientProfiles(
    {},
  );
  const clients = clientsData?.profiles ?? [];

  const uploadMutation = useUploadKYCDocument(clientId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !clientId) return;

    uploadMutation.mutate(
      {
        file,
        documentType: docType,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          router.push("/kyc/verifications");
        },
      },
    );
  }

  const isValid = !!file && !!clientId && !!docType;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="-ml-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Upload KYC Document
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit a new KYC document for verification
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Client Selector */}
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select
                  value={clientId}
                  onValueChange={setClientId}
                  disabled={clientsLoading}
                >
                  <SelectTrigger id="client" className="w-full">
                    <SelectValue
                      placeholder={
                        clientsLoading ? "Loading clients..." : "Select client"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name ?? c.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Document Type */}
              <div className="space-y-2">
                <Label htmlFor="docType">Document Type *</Label>
                <Select
                  value={docType}
                  onValueChange={setDocType}
                >
                  <SelectTrigger id="docType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KYC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Document File *</Label>
                <FileUploadZone
                  onFileSelect={setFile}
                  isUploading={uploadMutation.isPending}
                />
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date (optional)</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any relevant notes about this document..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={!isValid || uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}

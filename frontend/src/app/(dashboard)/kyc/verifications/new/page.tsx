"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listClientProfiles } from "@/lib/api/clients";
import { uploadKYCDocument } from "@/lib/api/kyc-verifications";
import type { KYCDocumentType } from "@/types/kyc-verification";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload } from "lucide-react";

const ALLOWED_ROLES = [
  "finance_compliance",
  "managing_director",
  "relationship_manager",
  "coordinator",
];

const DOCUMENT_TYPES: { value: KYCDocumentType; label: string }[] = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "proof_of_address", label: "Proof of Address" },
  { value: "tax_id", label: "Tax ID" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "source_of_wealth", label: "Source of Wealth" },
  { value: "other", label: "Other" },
];

export default function NewVerificationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  const [clientId, setClientId] = React.useState("");
  const [documentType, setDocumentType] = React.useState<KYCDocumentType | "">("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const isAllowed = user && ALLOWED_ROLES.includes(user.role);

  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClientProfiles({ limit: 200 }),
    enabled: !!isAllowed,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!clientId || !documentType || !file) {
        throw new Error("Missing required fields");
      }
      return uploadKYCDocument(
        clientId,
        file,
        documentType,
        expiryDate || undefined,
        notes || undefined,
      );
    },
    onSuccess: () => {
      router.push("/kyc/verifications");
    },
    onError: () => {
      setError("Failed to create verification. Please try again.");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Please select a client.");
      return;
    }
    if (!documentType) {
      setError("Please select a document type.");
      return;
    }
    if (!file) {
      setError("Please upload a document file.");
      return;
    }

    mutation.mutate();
  };

  if (!isAllowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          New KYC Verification
        </h1>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Verification Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsData?.profiles.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.display_name || client.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_type">Document Type</Label>
                <Select
                  value={documentType}
                  onValueChange={(val) => setDocumentType(val as KYCDocumentType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        {dt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Document File</Label>
                <div className="flex items-center gap-4">
                  <label
                    htmlFor="file"
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    {file ? file.name : "Choose file..."}
                  </label>
                  <input
                    id="file"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  {file && (
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this verification..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/kyc/verifications")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Uploading..." : "Submit Verification"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

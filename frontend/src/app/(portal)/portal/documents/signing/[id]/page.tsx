"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortalDocument, useAcknowledgeDocument } from "@/hooks/use-portal-documents";

export default function DocumentSigningPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const documentId = params.id;

  const { data: doc, isLoading, isError } = usePortalDocument(documentId);
  const acknowledgeMutation = useAcknowledgeDocument();

  const [agreed, setAgreed] = React.useState(false);
  const [signerName, setSignerName] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed || !signerName.trim()) return;

    acknowledgeMutation.mutate(
      { documentId, signerName: signerName.trim() },
      {
        onSuccess: () => {
          setSubmitted(true);
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-sm text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Document not found</AlertTitle>
          <AlertDescription>
            This document is not available or you do not have permission to view it.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push("/portal/documents")}>
          Back to Documents
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <h2 className="text-xl font-semibold">Document Acknowledged</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You have successfully acknowledged{" "}
                <span className="font-medium">{doc.file_name}</span>.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Signed as: <span className="font-medium">{signerName}</span> &nbsp;·&nbsp;{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <Button onClick={() => router.push("/portal/documents")}>Back to Documents</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Sign Document</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and acknowledge the document below
        </p>
      </div>

      {/* Document preview card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-50 rounded-lg shrink-0">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-serif text-lg leading-snug break-words">
                {doc.file_name}
              </CardTitle>
              {doc.description && (
                <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <div className="flex gap-6">
            <div>
              <span className="font-medium text-foreground">Category: </span>
              {doc.category}
            </div>
            <div>
              <span className="font-medium text-foreground">Uploaded: </span>
              {new Date(doc.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
          {doc.download_url && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(doc.download_url!, "_blank")}
              >
                Open Document to Review
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          By completing this form you confirm that you have reviewed the document in full and agree
          to its contents. This acknowledgment is recorded with your name and timestamp.
        </AlertDescription>
      </Alert>

      {/* Signing form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <Label htmlFor="agree" className="leading-snug cursor-pointer">
                I have reviewed the document{" "}
                <span className="font-medium">{doc.file_name}</span> in its entirety and agree to
                its contents.
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signerName">Full Name (typed signature)</Label>
              <Input
                id="signerName"
                placeholder="Type your full legal name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled={!agreed}
              />
              <p className="text-xs text-muted-foreground">
                Your typed name serves as your electronic signature.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/portal/documents")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!agreed || !signerName.trim() || acknowledgeMutation.isPending}
            >
              {acknowledgeMutation.isPending ? "Submitting..." : "Submit Acknowledgment"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

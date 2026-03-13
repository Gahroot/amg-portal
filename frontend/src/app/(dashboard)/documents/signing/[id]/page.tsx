"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { EmbeddedSigningView } from "@/components/docusign/embedded-signing-view";
import { useEnvelope, useSigningSession } from "@/hooks/use-envelopes";

interface SigningPageProps {
  params: Promise<{ id: string }>;
}

export default function SigningPage({ params }: SigningPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const {
    data: envelope,
    isLoading: envelopeLoading,
    error: envelopeError,
  } = useEnvelope(id);
  const canRequestSigning =
    envelope?.status === "sent" || envelope?.status === "delivered";
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useSigningSession(id, canRequestSigning);

  const returnPath = "/documents/envelopes";

  if (envelopeLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm text-muted-foreground">
            Loading document…
          </span>
        </div>
      </div>
    );
  }

  if (envelopeError || !envelope) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(returnPath)}
        >
          <ArrowLeft className="mr-1 size-4" />
          Back to Envelopes
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {envelopeError instanceof Error
              ? envelopeError.message
              : "Unable to load the envelope. It may have been removed or you don't have access."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!canRequestSigning) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(returnPath)}
        >
          <ArrowLeft className="mr-1 size-4" />
          Back to Envelopes
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">{envelope.subject}</CardTitle>
            <CardDescription>
              This document is not available for signing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{envelope.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">From</p>
                <p className="font-medium">{envelope.sender_name}</p>
              </div>
              {envelope.completed_at && (
                <div>
                  <p className="text-muted-foreground">Completed</p>
                  <p className="font-medium">
                    {new Date(envelope.completed_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {envelope.voided_reason && (
                <div>
                  <p className="text-muted-foreground">Void Reason</p>
                  <p className="font-medium">{envelope.voided_reason}</p>
                </div>
              )}
            </div>
            {envelope.recipients.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Recipients</p>
                <ul className="space-y-1">
                  {envelope.recipients.map((r, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{r.name}</span>{" "}
                      <span className="text-muted-foreground">
                        ({r.email})
                      </span>{" "}
                      — <span className="capitalize">{r.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(returnPath)}
        >
          <ArrowLeft className="mr-1 size-4" />
          Back to Envelopes
        </Button>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm text-muted-foreground">
            Preparing signing session…
          </span>
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(returnPath)}
        >
          <ArrowLeft className="mr-1 size-4" />
          Back to Envelopes
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Signing Unavailable</AlertTitle>
          <AlertDescription>
            {sessionError instanceof Error
              ? sessionError.message
              : "Unable to start the signing session. Please try again later."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(returnPath)}
        >
          <ArrowLeft className="mr-1 size-4" />
          Back to Envelopes
        </Button>
        <p className="text-sm text-muted-foreground truncate max-w-[300px]">
          {envelope.subject}
        </p>
      </div>

      <EmbeddedSigningView
        signingUrl={session.signing_url}
        integrationKey={session.integration_key}
        envelopeId={envelope.envelope_id}
        sandbox={session.sandbox}
        returnPath={returnPath}
        className="rounded-lg border"
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const DOCUSIGN_BUNDLE_URL = "https://js.docusign.com/bundle.js";
const DOCUSIGN_SANDBOX_BUNDLE_URL = "https://js-d.docusign.com/bundle.js";

type SessionEndType =
  | "signing_complete"
  | "viewing_complete"
  | "cancel"
  | "decline"
  | "exception"
  | "fax_pending"
  | "id_check_failed"
  | "session_timeout"
  | "ttl_expired";

interface DocuSignSessionEndEvent {
  sessionEndType: SessionEndType;
  [key: string]: unknown;
}

interface DocuSignReadyEvent {
  [key: string]: unknown;
}

interface DocuSignSigning {
  on(event: "ready", handler: (event: DocuSignReadyEvent) => void): void;
  on(event: "sessionEnd", handler: (event: DocuSignSessionEndEvent) => void): void;
  mount(selector: string): void;
}

interface DocuSignInstance {
  signing(config: {
    url: string;
    displayFormat: "focused" | "default";
    style?: {
      branding?: {
        primaryButton?: {
          backgroundColor?: string;
          color?: string;
        };
      };
      signingNavigationButton?: {
        finishText?: string;
        position?: "bottom-left" | "bottom-center" | "bottom-right";
      };
    };
  }): DocuSignSigning;
}

interface DocuSignGlobal {
  loadDocuSign(integrationKey: string): Promise<DocuSignInstance>;
}

declare global {
  interface Window {
    DocuSign?: DocuSignGlobal;
  }
}

type SigningStatus = "loading" | "ready" | "signing_complete" | "error" | "cancelled" | "declined";

interface EmbeddedSigningViewProps {
  signingUrl: string;
  integrationKey: string;
  envelopeId?: string;
  sandbox?: boolean;
  displayFormat?: "focused" | "default";
  onSigningComplete?: (envelopeId?: string) => void;
  onCancel?: () => void;
  onDecline?: () => void;
  onError?: (error: string) => void;
  returnPath?: string;
  className?: string;
  style?: {
    branding?: {
      primaryButton?: {
        backgroundColor?: string;
        color?: string;
      };
    };
    signingNavigationButton?: {
      finishText?: string;
      position?: "bottom-left" | "bottom-center" | "bottom-right";
    };
  };
}

const SESSION_END_MESSAGES: Record<SessionEndType, { message: string; type: "success" | "warning" | "error" }> = {
  signing_complete: { message: "Document signed successfully.", type: "success" },
  viewing_complete: { message: "Document viewing completed.", type: "success" },
  cancel: { message: "Signing was cancelled.", type: "warning" },
  decline: { message: "Signing was declined.", type: "warning" },
  exception: { message: "An error occurred during signing.", type: "error" },
  fax_pending: { message: "Document sent to fax, pending completion.", type: "warning" },
  id_check_failed: { message: "Identity verification failed.", type: "error" },
  session_timeout: { message: "Signing session timed out.", type: "error" },
  ttl_expired: { message: "Signing link has expired.", type: "error" },
};

function loadDocuSignScript(sandbox: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = sandbox ? DOCUSIGN_SANDBOX_BUNDLE_URL : DOCUSIGN_BUNDLE_URL;

    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      if (window.DocuSign) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Failed to load DocuSign SDK")));
      }
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load DocuSign SDK"));
    document.head.appendChild(script);
  });
}

export function EmbeddedSigningView({
  signingUrl,
  integrationKey,
  envelopeId,
  sandbox = false,
  displayFormat = "focused",
  onSigningComplete,
  onCancel,
  onDecline,
  onError,
  returnPath,
  className,
  style,
}: EmbeddedSigningViewProps) {
  const router = useRouter();
  const mountRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<SigningStatus>("loading");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;

    async function initSigning() {
      try {
        await loadDocuSignScript(sandbox);

        if (!mounted || !window.DocuSign) {
          throw new Error("DocuSign SDK not available after loading");
        }

        const docusign = await window.DocuSign.loadDocuSign(integrationKey);

        if (!mounted) return;

        const signingConfig: Parameters<DocuSignInstance["signing"]>[0] = {
          url: signingUrl,
          displayFormat,
        };

        if (style) {
          signingConfig.style = style;
        }

        const signing = docusign.signing(signingConfig);

        signing.on("ready", () => {
          if (!mounted) return;
          setStatus("ready");
        });

        signing.on("sessionEnd", (event: DocuSignSessionEndEvent) => {
          if (!mounted) return;

          const endType = event.sessionEndType;
          const info = SESSION_END_MESSAGES[endType] ?? {
            message: `Signing session ended: ${endType}`,
            type: "warning" as const,
          };

          switch (endType) {
            case "signing_complete":
            case "viewing_complete":
              setStatus("signing_complete");
              toast.success(info.message);
              onSigningComplete?.(envelopeId);
              if (returnPath) {
                router.push(returnPath);
              }
              break;

            case "cancel":
              setStatus("cancelled");
              toast.info(info.message);
              onCancel?.();
              break;

            case "decline":
              setStatus("declined");
              toast.warning(info.message);
              onDecline?.();
              break;

            case "exception":
            case "id_check_failed":
            case "session_timeout":
            case "ttl_expired":
              setStatus("error");
              setErrorMessage(info.message);
              toast.error(info.message);
              onError?.(info.message);
              break;

            case "fax_pending":
              toast.info(info.message);
              if (returnPath) {
                router.push(returnPath);
              }
              break;

            default:
              toast.info(info.message);
              break;
          }
        });

        signing.mount("#docusign-signing-container");
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Failed to initialize DocuSign signing";
        setStatus("error");
        setErrorMessage(message);
        toast.error(message);
        onError?.(message);
      }
    }

    initSigning();

    return () => {
      mounted = false;
    };
  }, [
    signingUrl,
    integrationKey,
    sandbox,
    displayFormat,
    style,
    envelopeId,
    onSigningComplete,
    onCancel,
    onDecline,
    onError,
    returnPath,
    router,
  ]);

  if (status === "signing_complete") {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="size-12 text-green-600" />
          <p className="text-lg font-semibold">Document Signed Successfully</p>
          <p className="text-sm text-muted-foreground">
            Your signature has been recorded. You may now close this page.
          </p>
          {returnPath && (
            <Button onClick={() => router.push(returnPath)}>Continue</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status === "cancelled") {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertTriangle className="size-12 text-yellow-500" />
          <p className="text-lg font-semibold">Signing Cancelled</p>
          <p className="text-sm text-muted-foreground">
            You cancelled the signing process. No changes have been made.
          </p>
          {returnPath && (
            <Button variant="outline" onClick={() => router.push(returnPath)}>
              Go Back
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status === "declined") {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <XCircle className="size-12 text-destructive" />
          <p className="text-lg font-semibold">Signing Declined</p>
          <p className="text-sm text-muted-foreground">
            You declined to sign this document.
          </p>
          {returnPath && (
            <Button variant="outline" onClick={() => router.push(returnPath)}>
              Go Back
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Signing Error</CardTitle>
          <CardDescription>
            There was a problem with the signing session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            {returnPath && (
              <Button variant="outline" onClick={() => router.push(returnPath)}>
                Go Back
              </Button>
            )}
            <Button
              onClick={() => {
                initializedRef.current = false;
                setStatus("loading");
                setErrorMessage(null);
                window.location.reload();
              }}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {status === "loading" && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm text-muted-foreground">
            Loading signing session…
          </span>
        </div>
      )}
      <div
        ref={mountRef}
        id="docusign-signing-container"
        className="min-h-[600px] w-full"
      />
    </div>
  );
}

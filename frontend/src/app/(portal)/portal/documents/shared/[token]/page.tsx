"use client";

import * as React from "react";
import { use } from "react";
import { Shield, FileText, Clock, AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSharedDocumentInfo,
  requestShareVerificationCode,
  accessSharedDocument,
} from "@/lib/api/documents";
import type { DocumentShareInfo, DocumentShareAccessResponse } from "@/lib/api/documents";

interface PageProps {
  params: Promise<{ token: string }>;
}

type PageState = "loading" | "ready" | "verifying" | "granted" | "error" | "expired" | "revoked";

export default function SharedDocumentPage({ params }: PageProps) {
  const { token } = use(params);

  const [state, setState] = React.useState<PageState>("loading");
  const [info, setInfo] = React.useState<DocumentShareInfo | null>(null);
  const [access, setAccess] = React.useState<DocumentShareAccessResponse | null>(null);
  const [code, setCode] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isRequestingCode, setIsRequestingCode] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [codeSentMessage, setCodeSentMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    getSharedDocumentInfo(token)
      .then((data) => {
        setInfo(data);
        setState("ready");
      })
      .catch((err: unknown) => {
        const status =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
        if (status === 410) {
          // Check if expired vs revoked based on error detail
          const detail =
            err && typeof err === "object" && "response" in err
              ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? ""
              : "";
          if (detail.toLowerCase().includes("revok")) {
            setState("revoked");
          } else {
            setState("expired");
          }
        } else {
          setState("error");
        }
      });
  }, [token]);

  async function handleRequestCode() {
    setCodeSentMessage(null);
    setErrorMessage(null);
    setIsRequestingCode(true);
    try {
      const res = await requestShareVerificationCode(token);
      setCodeSentMessage(res.message);
    } catch {
      setErrorMessage("Failed to send verification code. Please try again.");
    } finally {
      setIsRequestingCode(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setErrorMessage(null);
    setIsVerifying(true);
    try {
      const result = await accessSharedDocument(token, code.trim());
      setAccess(result);
      setState("granted");
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setErrorMessage(detail ?? "Invalid or expired verification code.");
    } finally {
      setIsVerifying(false);
    }
  }

  function formatExpiry(iso: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">Share not found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This share link is invalid or no longer exists.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">Link has expired</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This document share link has expired. Please ask the sender to share it again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "revoked") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500/70" />
            <h2 className="text-lg font-semibold">Access revoked</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Access to this document has been revoked by the sender.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "granted" && access) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>Access granted</CardTitle>
            </div>
            <CardDescription>
              You now have secure access to <strong>{access.file_name}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>
                  Access level: <strong>{access.access_level === "download" ? "View & download" : "View only"}</strong>
                </span>
              </div>
              {access.expires_at && (
                <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Link expires: {formatExpiry(access.expires_at)}</span>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => window.open(access.view_url, "_blank")}
            >
              <FileText className="mr-2 h-4 w-4" />
              View document
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              This access has been logged. The verification code is now invalid — request a new one
              if you need to view again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // state === "ready" — show verification form
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Secure document access</CardTitle>
          </div>
          {info && (
            <CardDescription>
              You have been given access to <strong>{info.file_name}</strong>.
              {info.expires_at && (
                <span className="block mt-1 text-xs">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Access expires {formatExpiry(info.expires_at)}
                </span>
              )}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Step 1: Request OTP */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              To verify your identity, click the button below to receive a one-time code at{" "}
              <strong>{info?.shared_with_email}</strong>.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRequestCode}
              disabled={isRequestingCode}
            >
              {isRequestingCode ? "Sending…" : "Send verification code"}
            </Button>
            {codeSentMessage && (
              <p className="text-sm text-green-700">{codeSentMessage}</p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Then enter your code</span>
            </div>
          </div>

          {/* Step 2: Enter code */}
          <form onSubmit={handleVerify} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="otp-code">Verification code</Label>
              <Input
                id="otp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
                disabled={isVerifying}
              />
            </div>

            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isVerifying || code.length !== 6}
            >
              {isVerifying ? "Verifying…" : "Access document"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Codes expire after 15 minutes. Your access will be logged for security purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { setupMFA, verifyMFASetup } from "@/lib/api/auth";
import { setTokens } from "@/lib/token-storage";
import { useAuth } from "@/providers/auth-provider";
import type { MFASetupResponse } from "@/types/user";

type SetupStep = "loading" | "verify" | "success" | "error";

export function MFASetup({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<SetupStep>("loading");
  const [setupData, setSetupData] =
    useState<MFASetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initSetup() {
      try {
        const data = await setupMFA();
        if (!cancelled) {
          setSetupData(data);
          setStep("verify");
        }
      } catch {
        if (!cancelled) {
          setError("Failed to initialize MFA setup.");
          setStep("error");
        }
      }
    }

    void initSetup();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const tokenResponse = await verifyMFASetup(code);
      // Store real tokens returned on successful setup, then clear the
      // ephemeral setup token — the user is now fully authenticated.
      if (tokenResponse.access_token) {
        setTokens(
          tokenResponse.access_token,
          tokenResponse.refresh_token
        );
      }
      setStep("success");
    } catch {
      setError("Invalid verification code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  function handleDone() {
    if (onComplete) {
      onComplete();
      return;
    }
    // Re-fetch the current user inside the AuthProvider so it picks up
    // the new tokens and mfa_enabled flag, then the redirect effect
    // routes to the correct dashboard — no hard page reload needed.
    refreshUser();
  }

  if (step === "loading") {
    return (
      <p className="text-sm text-muted-foreground">
        Setting up MFA...
      </p>
    );
  }

  if (step === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error ?? "An unknown error occurred."}
        </AlertDescription>
      </Alert>
    );
  }

  if (step === "success") {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            MFA has been enabled successfully. Your account is now
            protected with two-factor authentication.
          </AlertDescription>
        </Alert>
        <Button onClick={handleDone} className="w-full">
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">
          Scan the QR Code
        </h3>
        <p className="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app (e.g.
          Google Authenticator, Authy).
        </p>
        {setupData && (
          <div className="flex justify-center rounded-lg border bg-card p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${setupData.qr_code_base64}`}
              alt="MFA QR Code"
              width={200}
              height={200}
            />
          </div>
        )}
        {setupData && (
          <p className="break-all text-xs text-muted-foreground">
            Manual entry key: {setupData.secret}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Backup Codes</h3>
        <p className="text-sm text-muted-foreground">
          Save these backup codes in a secure place. Each code can
          only be used once.
        </p>
        {setupData && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4 sm:grid-cols-4">
            {setupData.backup_codes.map((backupCode) => (
              <code
                key={backupCode}
                className="rounded bg-background px-2 py-1 text-center font-mono text-sm"
              >
                {backupCode}
              </code>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="mfa-code">Verification Code</Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={8}
          />
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code from your authenticator app to
            verify setup.
          </p>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || code.length < 6}
        >
          {isSubmitting ? "Verifying..." : "Verify and Enable MFA"}
        </Button>
      </form>
    </div>
  );
}

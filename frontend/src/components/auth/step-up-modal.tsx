"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useStepUpStore } from "@/stores/step-up";
import { mintStepUpToken } from "@/lib/api/step-up";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Factor = "password" | "totp";

const ACTION_LABELS: Record<string, string> = {
  view_pii: "view this client's personal information",
  user_delete: "delete this user account",
  user_disable: "deactivate this user",
  mfa_change: "change your MFA settings",
  file_read_sensitive: "open this sensitive document",
  wire_approve: "approve this wire transfer",
  program_delete: "delete this program",
  export_data: "export this data",
  break_glass: "activate break-glass access",
};

function describe(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function StepUpModal() {
  const { user } = useAuth();
  const pendingAction = useStepUpStore((s) => s.pendingAction);
  const fulfillPrompt = useStepUpStore((s) => s.fulfillPrompt);
  const cacheToken = useStepUpStore((s) => s.cacheToken);

  const [factor, setFactor] = useState<Factor>("password");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (pendingAction) {
      setFactor(user?.mfa_enabled ? "totp" : "password");
      setPassword("");
      setTotp("");
      setError(null);
      setSubmitting(false);
    }
  }, [pendingAction, user?.mfa_enabled]);

  if (!pendingAction) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await mintStepUpToken({
        action_scope: [pendingAction],
        password: factor === "password" ? password : undefined,
        totp_code: factor === "totp" ? totp : undefined,
      });
      cacheToken(resp.action_scope, resp.step_up_token, resp.expires_in);
      fulfillPrompt(resp.step_up_token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Re-authentication failed. Please try again."
      );
      setSubmitting(false);
    }
  };

  const cancel = () => {
    fulfillPrompt(null);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && cancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm it&apos;s you</DialogTitle>
          <DialogDescription>
            For your security, please re-authenticate to {describe(pendingAction)}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {user?.mfa_enabled && (
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setFactor("totp")}
                className={
                  factor === "totp"
                    ? "font-semibold underline"
                    : "text-muted-foreground"
                }
              >
                Use MFA code
              </button>
              <span className="text-muted-foreground">•</span>
              <button
                type="button"
                onClick={() => setFactor("password")}
                className={
                  factor === "password"
                    ? "font-semibold underline"
                    : "text-muted-foreground"
                }
              >
                Use password
              </button>
            </div>
          )}

          {factor === "password" ? (
            <div className="space-y-2">
              <Label htmlFor="step-up-password">Password</Label>
              <Input
                id="step-up-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="step-up-totp">Authentication code</Label>
              <Input
                id="step-up-totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                maxLength={8}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the code from your authenticator app.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                (factor === "password" ? !password : totp.length < 6)
              }
            >
              {submitting ? "Verifying…" : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

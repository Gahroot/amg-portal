"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { disableMFA } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MFASetup } from "@/components/auth/mfa-setup";

type PageState = "idle" | "setup" | "disable";

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [pageState, setPageState] =
    React.useState<PageState>("idle");
  const [mfaEnabled, setMfaEnabled] = React.useState(false);
  const [disableCode, setDisableCode] = React.useState("");
  const [disableError, setDisableError] = React.useState<
    string | null
  >(null);
  const [isDisabling, setIsDisabling] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<
    string | null
  >(null);

  // We don't have mfa_enabled on the user object from the API,
  // so we track it locally after actions.
  // In a real app you'd add mfa_enabled to UserResponse.

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError(null);
    setIsDisabling(true);

    try {
      await disableMFA(disableCode);
      setMfaEnabled(false);
      setPageState("idle");
      setDisableCode("");
      setSuccessMsg("MFA has been disabled.");
    } catch {
      setDisableError(
        "Invalid verification code. Please try again."
      );
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Security Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account security preferences.
        </p>
      </div>

      {successMsg && (
        <Alert>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account by
            requiring a code from your authenticator app when
            signing in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pageState === "idle" && !mfaEnabled && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                MFA is currently{" "}
                <span className="font-medium text-foreground">
                  disabled
                </span>
                .
              </p>
              <Button
                onClick={() => {
                  setSuccessMsg(null);
                  setPageState("setup");
                }}
              >
                Enable MFA
              </Button>
            </div>
          )}

          {pageState === "idle" && mfaEnabled && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                MFA is currently{" "}
                <span className="font-medium text-green-600">
                  enabled
                </span>
                .
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  setSuccessMsg(null);
                  setPageState("disable");
                }}
              >
                Disable MFA
              </Button>
            </div>
          )}

          {pageState === "setup" && (
            <div className="space-y-4">
              <MFASetup
                onComplete={() => {
                  setMfaEnabled(true);
                  setPageState("idle");
                  setSuccessMsg(
                    "MFA has been enabled successfully."
                  );
                }}
              />
              <Button
                variant="outline"
                onClick={() => setPageState("idle")}
              >
                Cancel
              </Button>
            </div>
          )}

          {pageState === "disable" && (
            <form
              onSubmit={handleDisable}
              className="space-y-4"
            >
              {disableError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {disableError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="disable-code">
                  Verification Code
                </Label>
                <Input
                  id="disable-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit code"
                  value={disableCode}
                  onChange={(e) =>
                    setDisableCode(e.target.value)
                  }
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a code from your authenticator app to
                  confirm disabling MFA.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    isDisabling || disableCode.length < 6
                  }
                >
                  {isDisabling
                    ? "Disabling..."
                    : "Confirm Disable"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPageState("idle");
                    setDisableCode("");
                    setDisableError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="capitalize">{user.role}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

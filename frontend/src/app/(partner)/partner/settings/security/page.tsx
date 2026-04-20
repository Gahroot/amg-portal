"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/providers/auth-provider";
import { disableMFA } from "@/lib/api/auth";
import { useChangePassword } from "@/hooks/use-settings";
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
import { PasskeysCard } from "@/components/auth/passkeys-card";

type PageState = "idle" | "setup" | "disable";

export default function PartnerSecurityPage() {
  const { user } = useAuth();
  const changePassword = useChangePassword();

  // MFA state
  const [pageState, setPageState] = useState<PageState>("idle");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Initialize MFA state from user
  useEffect(() => {
    if (user) {
      setMfaEnabled(user.mfa_enabled);
    }
  }, [user]);

  const handleDisableMFA = async (e: FormEvent) => {
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
      setDisableError("Invalid verification code. Please try again.");
    } finally {
      setIsDisabling(false);
    }
  };

  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    changePassword.mutate(
      {
        current_password: currentPassword,
        new_password: newPassword,
      },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setSuccessMsg("Password changed successfully.");
        },
        onError: (error) => {
          setPasswordError(
            error instanceof Error ? error.message : "Failed to change password"
          );
        },
      }
    );
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {successMsg && (
        <Alert>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* MFA Card */}
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account by requiring a code
            from your authenticator app when signing in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pageState === "idle" && !mfaEnabled && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                MFA is currently{" "}
                <span className="font-medium text-foreground">disabled</span>.
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
                <span className="font-medium text-green-600 dark:text-green-400">enabled</span>.
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
                  setSuccessMsg("MFA has been enabled successfully.");
                }}
              />
              <Button variant="outline" onClick={() => setPageState("idle")}>
                Cancel
              </Button>
            </div>
          )}

          {pageState === "disable" && (
            <form onSubmit={handleDisableMFA} className="space-y-4">
              {disableError && (
                <Alert variant="destructive">
                  <AlertDescription>{disableError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="disable-code">Verification Code</Label>
                <Input
                  id="disable-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a code from your authenticator app to confirm disabling
                  MFA.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isDisabling || disableCode.length < 6}
                >
                  {isDisabling ? "Disabling..." : "Confirm Disable"}
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

      {/* Passkeys Card */}
      <PasskeysCard />

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with uppercase, lowercase, number,
                and special character.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Information Card */}
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
              <dt className="text-muted-foreground">Status</dt>
              <dd className="capitalize">{user.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Member Since</dt>
              <dd>{new Date(user.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

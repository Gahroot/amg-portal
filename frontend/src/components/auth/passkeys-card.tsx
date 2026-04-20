"use client";

import { useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
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
import {
  deletePasskey,
  isWebAuthnSupported,
  listPasskeys,
  registerPasskey,
  type PasskeySummary,
} from "@/lib/api/webauthn";

function formatDate(value: string | null): string {
  if (!value) return "never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function PasskeysCard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isWebAuthnSupported());
  }, []);

  useEffect(() => {
    if (supported === null) return;
    void refresh();
  }, [supported]);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listPasskeys();
      setPasskeys(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load passkeys.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setRegistering(true);
    try {
      await registerPasskey(nickname.trim() || null);
      setNickname("");
      setSuccess("Passkey registered successfully.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Passkey registration failed. Please try again."
      );
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (credentialId: string) => {
    setError(null);
    setSuccess(null);
    try {
      await deletePasskey(credentialId);
      setSuccess("Passkey removed.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove passkey."
      );
    }
  };

  if (supported === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Passkeys
        </CardTitle>
        <CardDescription>
          Register a device passkey (Touch ID, Windows Hello, or a security key)
          for passwordless sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported && (
          <Alert>
            <AlertDescription>
              This browser does not support passkeys. Try Safari, Chrome, Edge,
              or Firefox on a recent desktop / mobile OS.
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No passkeys registered yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {passkeys.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">
                    {p.nickname || "Unnamed passkey"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {formatDate(p.created_at)} • Last used{" "}
                    {formatDate(p.last_used_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(p.id)}
                  aria-label={`Remove passkey ${p.nickname || p.id}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {supported && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="passkey-nickname">Nickname (optional)</Label>
              <Input
                id="passkey-nickname"
                placeholder="e.g. MacBook Touch ID"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={100}
              />
            </div>
            <Button type="submit" disabled={registering}>
              {registering ? "Registering…" : "Register this device"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

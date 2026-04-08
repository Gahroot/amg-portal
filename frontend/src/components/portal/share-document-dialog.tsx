"use client";

import * as React from "react";
import { Share2, Trash2, Clock, Eye, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  createDocumentShare,
  listDocumentShares,
  revokeDocumentShare,
} from "@/lib/api/documents";
import type { DocumentShare } from "@/lib/api/documents";

interface ShareDocumentDialogProps {
  documentId: string;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPIRY_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export function ShareDocumentDialog({
  documentId,
  documentName,
  open,
  onOpenChange,
}: ShareDocumentDialogProps) {
  const [email, setEmail] = React.useState("");
  const [accessLevel, setAccessLevel] = React.useState<"view" | "download">("view");
  const [expiresHours, setExpiresHours] = React.useState("72");
  const [shares, setShares] = React.useState<DocumentShare[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  // Load existing shares when dialog opens
  React.useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    listDocumentShares(documentId)
      .then((res) => setShares(res.shares))
      .catch(() => {/* ignore */})
      .finally(() => setIsLoading(false));
  }, [open, documentId]);

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter a recipient email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newShare = await createDocumentShare(documentId, {
        shared_with_email: email.trim(),
        access_level: accessLevel,
        expires_hours: parseInt(expiresHours, 10),
      });
      setShares((prev) => [newShare, ...prev]);
      setSuccessMessage(
        `Document shared with ${email.trim()}. A verification code has been sent to their email.`,
      );
      setEmail("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to share document. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(shareId: string) {
    setRevokingId(shareId);
    try {
      await revokeDocumentShare(shareId);
      setShares((prev) =>
        prev.map((s) =>
          s.id === shareId ? { ...s, is_active: false, revoked_at: new Date().toISOString() } : s,
        ),
      );
    } catch {
      /* ignore */
    } finally {
      setRevokingId(null);
    }
  }

  const activeShares = shares.filter((s) => s.is_active && !isExpired(s.expires_at));
  const inactiveShares = shares.filter((s) => !s.is_active || isExpired(s.expires_at));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Document
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Share <strong>{documentName}</strong> with family members or advisors. Recipients will
            receive an email with a verification code to access the document securely.
          </DialogDescription>
        </DialogHeader>

        {/* Share form */}
        <form onSubmit={handleShare} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-email">Recipient email</Label>
            <Input
              id="share-email"
              type="email"
              placeholder="advisor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Access level</Label>
              <Select
                value={accessLevel}
                onValueChange={(v) => setAccessLevel(v as "view" | "download")}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      View only
                    </span>
                  </SelectItem>
                  <SelectItem value="download">
                    <span className="flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      View & download
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Link expires</Label>
              <Select
                value={expiresHours}
                onValueChange={setExpiresHours}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {successMessage && (
            <div className="flex items-start gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-800 dark:text-green-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-800 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button type="submit" disabled={isSubmitting || !email.trim()} className="w-full">
            {isSubmitting ? "Sharing…" : "Send share link"}
          </Button>
        </form>

        {/* Active shares list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading shares…</p>
        ) : activeShares.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active shares
            </p>
            <div className="divide-y rounded-md border">
              {activeShares.map((share) => (
                <div key={share.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{share.shared_with_email}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {share.access_level === "download" ? (
                          <Download className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                        {share.access_level === "download" ? "View & download" : "View only"}
                      </span>
                      {share.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {formatDate(share.expires_at)}
                        </span>
                      )}
                      {share.access_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {share.access_count} access{share.access_count !== 1 ? "es" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(share.id)}
                    disabled={revokingId === share.id}
                    title="Revoke access"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Revoked / expired shares */}
        {inactiveShares.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Revoked / expired
            </p>
            <div className="divide-y rounded-md border bg-muted/30">
              {inactiveShares.map((share) => (
                <div key={share.id} className="flex items-center px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-muted-foreground">{share.shared_with_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {share.revoked_at ? `Revoked ${formatDate(share.revoked_at)}` : "Expired"}
                      {" · "}
                      {share.access_count} access{share.access_count !== 1 ? "es" : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {isExpired(share.expires_at) && share.is_active ? "Expired" : "Revoked"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Recipients verify their identity via a one-time code sent to their email. All access is
          logged for your security.
        </p>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useProvisionClient } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ClientProvisionDialogProps {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientProvisionDialog({
  profileId,
  open,
  onOpenChange,
}: ClientProvisionDialogProps) {
  const [sendWelcomeEmail, setSendWelcomeEmail] = React.useState(true);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const provisionMutation = useProvisionClient(profileId);

  const handleSubmit = async () => {
    setError(null);
    try {
      await provisionMutation.mutateAsync({
        send_welcome_email: sendWelcomeEmail,
        password: password || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setPassword("");
      }, 1500);
    } catch {
      setError("Failed to provision client. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Provision Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>
                Client provisioned successfully.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="welcome-email">Send Welcome Email</Label>
            <Switch
              id="welcome-email"
              checked={sendWelcomeEmail}
              onCheckedChange={setSendWelcomeEmail}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provision-password">
              Password (optional, auto-generated if empty)
            </Label>
            <Input
              id="provision-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for auto-generated"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={provisionMutation.isPending}
          >
            {provisionMutation.isPending ? "Provisioning..." : "Provision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

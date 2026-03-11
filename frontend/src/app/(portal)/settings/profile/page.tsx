"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useUpdateProfile } from "@/hooks/use-settings";
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

export default function PortalProfilePage() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhoneNumber(user.phone_number ?? "");
    }
  }, [user]);

  const markChanged = () => setHasChanges(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      {
        full_name: fullName,
        phone_number: phoneNumber || undefined,
      },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal information and contact details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {updateProfile.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {updateProfile.error instanceof Error
                  ? updateProfile.error.message
                  : "Failed to update profile"}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact support if needed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full-name">Full Name</Label>
            <Input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                markChanged();
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                markChanged();
              }}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Account Status</Label>
            <Input
              value={user.status.charAt(0).toUpperCase() + user.status.slice(1)}
              disabled
              className="bg-muted"
            />
          </div>

          <Button type="submit" disabled={!hasChanges || updateProfile.isPending}>
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

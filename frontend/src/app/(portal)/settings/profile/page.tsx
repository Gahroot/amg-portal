"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useUpdateProfile } from "@/hooks/use-settings";
import {
  usePortalProfilePreferences,
  useUpdatePortalProfilePreferences,
} from "@/hooks/use-schedules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const COMMUNICATION_OPTIONS = [
  { value: "in_portal", label: "In-Portal Only" },
  { value: "email", label: "Email Only" },
  { value: "both", label: "Both Email & Portal" },
];

export default function PortalProfilePage() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const { data: profilePrefs, isLoading: prefsLoading } =
    usePortalProfilePreferences();
  const updateProfilePrefs = useUpdatePortalProfilePreferences();

  const [fullName, setFullName] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [hasProfileChanges, setHasProfileChanges] = React.useState(false);

  const [communicationPref, setCommunicationPref] = React.useState("");
  const [sensitivities, setSensitivities] = React.useState("");
  const [specialInstructions, setSpecialInstructions] = React.useState("");
  const [hasPrefChanges, setHasPrefChanges] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhoneNumber(user.phone_number ?? "");
    }
  }, [user]);

  React.useEffect(() => {
    if (profilePrefs) {
      setCommunicationPref(profilePrefs.communication_preference ?? "");
      setSensitivities(profilePrefs.sensitivities ?? "");
      setSpecialInstructions(profilePrefs.special_instructions ?? "");
      setHasPrefChanges(false);
    }
  }, [profilePrefs]);

  const markProfileChanged = () => setHasProfileChanges(true);
  const markPrefChanged = () => setHasPrefChanges(true);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      {
        full_name: fullName,
        phone_number: phoneNumber || undefined,
      },
      {
        onSuccess: () => {
          setHasProfileChanges(false);
        },
      },
    );
  };

  const handlePrefsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfilePrefs.mutate(
      {
        communication_preference: communicationPref || undefined,
        sensitivities: sensitivities || undefined,
        special_instructions: specialInstructions || undefined,
      },
      {
        onSuccess: () => {
          setHasPrefChanges(false);
        },
      },
    );
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Basic Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information and contact details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
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
                  markProfileChanged();
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
                  markProfileChanged();
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

            <Button
              type="submit"
              disabled={!hasProfileChanges || updateProfile.isPending}
            >
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Communication & Service Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Communication & Service Preferences</CardTitle>
          <CardDescription>
            Manage how we communicate with you and any special considerations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prefsLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading preferences...
            </p>
          ) : (
            <form onSubmit={handlePrefsSubmit} className="space-y-4">
              {updateProfilePrefs.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {updateProfilePrefs.error instanceof Error
                      ? updateProfilePrefs.error.message
                      : "Failed to update preferences"}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="comm-pref">Communication Preference</Label>
                <Select
                  value={communicationPref}
                  onValueChange={(v) => {
                    setCommunicationPref(v);
                    markPrefChanged();
                  }}
                >
                  <SelectTrigger id="comm-pref" className="w-[280px]">
                    <SelectValue placeholder="Select preference" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMUNICATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How you prefer to receive updates and communications.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sensitivities">Sensitivities</Label>
                <Textarea
                  id="sensitivities"
                  value={sensitivities}
                  onChange={(e) => {
                    setSensitivities(e.target.value);
                    markPrefChanged();
                  }}
                  placeholder="Any topics, dates, or situations to be mindful of..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Note any topics or considerations our team should be aware of.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="special-instructions">
                  Special Instructions
                </Label>
                <Textarea
                  id="special-instructions"
                  value={specialInstructions}
                  onChange={(e) => {
                    setSpecialInstructions(e.target.value);
                    markPrefChanged();
                  }}
                  placeholder="Any special requests or standing instructions..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Standing instructions for your relationship manager and our
                  service team.
                </p>
              </div>

              <Button
                type="submit"
                disabled={!hasPrefChanges || updateProfilePrefs.isPending}
              >
                {updateProfilePrefs.isPending
                  ? "Saving..."
                  : "Save Preferences"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

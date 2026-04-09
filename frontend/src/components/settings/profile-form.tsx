"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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
import {
  ValidatedInput,
  commonValidationRules,
  type FieldValidationState,
} from "@/components/ui/validated-input";

export function ProfileForm() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhoneNumber(user.phone_number ?? "");
    }
  }, [user]);

  const markChanged = () => setHasChanges(true);

  const handleFullNameValidation = (state: FieldValidationState) => {
    setIsFormValid(state.isValid);
  };

  const handlePhoneValidation = (_state: FieldValidationState) => {
    // Phone is optional, so we don't block form submission
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
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

          <ValidatedInput
            id="full-name"
            label="Full Name"
            value={fullName}
            onChange={(value) => {
              setFullName(value);
              markChanged();
            }}
            rules={commonValidationRules.name}
            validationMode="onChange"
            showValidMark
            onValidationChange={handleFullNameValidation}
            required
          />

          <ValidatedInput
            id="phone"
            label="Phone Number"
            type="tel"
            value={phoneNumber}
            onChange={(value) => {
              setPhoneNumber(value);
              markChanged();
            }}
            rules={commonValidationRules.phone}
            validationMode="onBlur"
            placeholder="+1 (555) 000-0000"
            showValidMark
            onValidationChange={handlePhoneValidation}
          />

          <div className="space-y-2">
            <Label>Role</Label>
            <Input
              value={user.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              disabled
              className="bg-muted"
            />
          </div>

          <Button type="submit" disabled={!hasChanges || !isFormValid || updateProfile.isPending}>
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

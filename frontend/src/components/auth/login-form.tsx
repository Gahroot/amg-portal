"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, MFASetupRequiredError } from "@/providers/auth-provider";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = React.useState(false);
  const [mfaCode, setMfaCode] = React.useState("");
  const [isMfaSubmitting, setIsMfaSubmitting] =
    React.useState(false);
  const [savedCredentials, setSavedCredentials] =
    React.useState<LoginFormData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data);
    } catch (err) {
      if (err instanceof MFASetupRequiredError) {
        router.replace("/mfa-setup");
        return;
      }
      const typedErr = err as {
        mfaRequired?: boolean;
        response?: { data?: { detail?: string } };
        message?: string;
      };
      if (typedErr.mfaRequired) {
        setSavedCredentials(data);
        setMfaRequired(true);
      } else {
        const message =
          typedErr.response?.data?.detail ??
          typedErr.message ??
          "Invalid email or password. Please try again.";
        setError(message);
      }
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedCredentials) return;
    setError(null);
    setIsMfaSubmitting(true);

    try {
      await login({
        ...savedCredentials,
        mfa_code: mfaCode,
      });
    } catch (err) {
      const message =
        (
          err as {
            response?: { data?: { detail?: string } };
          }
        )?.response?.data?.detail ??
        "Invalid MFA code. Please try again.";
      setError(message);
    } finally {
      setIsMfaSubmitting(false);
    }
  };

  if (mfaRequired) {
    return (
      <form onSubmit={handleMfaSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="mfa-code">
            Two-Factor Authentication Code
          </Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter 6-digit code or backup code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            maxLength={8}
          />
          <p className="text-xs text-muted-foreground">
            Enter the code from your authenticator app, or use a
            backup code.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isMfaSubmitting || mfaCode.length < 6}
        >
          {isMfaSubmitting ? "Verifying..." : "Verify"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            setMfaRequired(false);
            setMfaCode("");
            setError(null);
            setSavedCredentials(null);
          }}
        >
          Back to Login
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@anchormillgroup.com"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}

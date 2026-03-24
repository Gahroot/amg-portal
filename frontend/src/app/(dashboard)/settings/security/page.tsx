"use client";

import { SecuritySettingsForm } from "@/components/settings/security-settings-form";

export default function DashboardSecuritySettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground">
          Manage your password, two-factor authentication, and account security.
        </p>
      </div>
      <SecuritySettingsForm />
    </div>
  );
}

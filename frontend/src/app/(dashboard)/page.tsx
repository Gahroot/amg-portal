"use client";

import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  relationship_manager: "Relationship Manager",
  coordinator: "Coordinator",
  finance_compliance: "Finance & Compliance",
  client: "Client",
  partner: "Partner",
};

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <Button variant="outline" onClick={logout}>
            Sign Out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back, {user?.full_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge variant="secondary">
                {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Email:</span>
              <span className="text-sm">{user?.email}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCapabilityRefreshStatus,
  useSubmitCapabilityRefresh,
  usePartnerProfile,
} from "@/hooks/use-partner-portal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  FileCheck2,
  Users,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export default function CapabilityRefreshPage() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = usePartnerProfile();
  const { data: refreshStatus, isLoading: statusLoading } = useCapabilityRefreshStatus();
  const submitMutation = useSubmitCapabilityRefresh();

  const [accreditationsConfirmed, setAccreditationsConfirmed] = useState(false);
  const [insuranceConfirmed, setInsuranceConfirmed] = useState(false);
  const [capacityConfirmed, setCapacityConfirmed] = useState(false);

  const confirmationCount = [accreditationsConfirmed, insuranceConfirmed, capacityConfirmed].filter(
    Boolean
  ).length;
  const allConfirmed = confirmationCount === 3;
  const progressPct = Math.round((confirmationCount / 3) * 100);

  const isLoading = profileLoading || statusLoading;

  const handleSubmit = () => {
    if (!allConfirmed) return;
    submitMutation.mutate(
      {
        accreditations_confirmed: true,
        insurance_confirmed: true,
        capacity_confirmed: true,
      },
      {
        onSuccess: () => {
          router.push("/partner");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Already completed this year
  if (refreshStatus && !refreshStatus.is_overdue && !refreshStatus.is_due_soon && refreshStatus.last_refreshed_at) {
    const refreshedDate = new Date(refreshStatus.last_refreshed_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const dueDate = refreshStatus.refresh_due_at
      ? new Date(refreshStatus.refresh_due_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/partner">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <Card className="border-green-200 dark:border-green-800 bg-green-50/50">
          <CardContent className="flex items-center gap-4 py-8">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-green-900 dark:text-green-300">Capability refresh up to date</h2>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Last confirmed on {refreshedDate}.
                {dueDate && ` Next refresh due ${dueDate}.`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" asChild>
          <Link href="/partner">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/partner">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight">Annual Capability Refresh</h1>
          {refreshStatus?.is_overdue && (
            <Badge variant="destructive">Overdue</Badge>
          )}
          {refreshStatus?.is_due_soon && !refreshStatus.is_overdue && (
            <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
              Due Soon
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Please review and confirm your current accreditations, insurance coverage, and available
          capacity. This annual refresh is required to maintain your active partner status.
        </p>
      </div>

      {/* Status banner */}
      {refreshStatus?.is_overdue && (
        <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-300">
            Your annual capability refresh is overdue. Please complete it to remain active in our
            partner network.
          </AlertDescription>
        </Alert>
      )}

      {/* Progress */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Confirmation Progress</span>
            <span className="text-sm text-muted-foreground">{confirmationCount} / 3 confirmed</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Current capabilities summary */}
      {profile && (profile.capabilities.length > 0 || profile.geographies.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Current Profile</CardTitle>
            <CardDescription>
              Review this information as part of your confirmation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.capabilities.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Capabilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.capabilities.map((cap) => (
                    <Badge key={cap} variant="secondary">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.geographies.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Geographies</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.geographies.map((geo) => (
                    <Badge key={geo} variant="outline">
                      {geo}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 1: Accreditations */}
      <Card
        className={
          accreditationsConfirmed
            ? "border-green-200 dark:border-green-800 bg-green-50/30"
            : "hover:border-primary/40 transition-colors"
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${accreditationsConfirmed ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                <ShieldCheck
                  className={`h-5 w-5 ${accreditationsConfirmed ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}
                />
              </div>
              <div>
                <CardTitle className="text-base">Accreditations &amp; Certifications</CardTitle>
                <CardDescription className="mt-0.5">
                  Confirm your professional accreditations are current and valid
                </CardDescription>
              </div>
            </div>
            {accreditationsConfirmed && (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1.5 mb-4">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              All professional licences and certifications are up to date
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              Any expiring accreditations have been renewed or are in progress
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              Regulatory requirements for your service categories remain satisfied
            </li>
          </ul>
          <Button
            variant={accreditationsConfirmed ? "outline" : "default"}
            size="sm"
            onClick={() => setAccreditationsConfirmed((v) => !v)}
          >
            {accreditationsConfirmed ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Confirmed — click to revise
              </>
            ) : (
              "Confirm Accreditations"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Section 2: Insurance */}
      <Card
        className={
          insuranceConfirmed
            ? "border-green-200 dark:border-green-800 bg-green-50/30"
            : "hover:border-primary/40 transition-colors"
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${insuranceConfirmed ? "bg-green-100 dark:bg-green-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                <FileCheck2
                  className={`h-5 w-5 ${insuranceConfirmed ? "text-green-600 dark:text-green-400" : "text-purple-600 dark:text-purple-400"}`}
                />
              </div>
              <div>
                <CardTitle className="text-base">Insurance Coverage</CardTitle>
                <CardDescription className="mt-0.5">
                  Confirm your insurance policies remain current and at required levels
                </CardDescription>
              </div>
            </div>
            {insuranceConfirmed && (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1.5 mb-4">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              Professional indemnity and public liability insurance is active
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              Coverage levels meet the minimum requirements set out in your agreement
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              Policy expiry dates are more than 30 days away or renewals are arranged
            </li>
          </ul>
          <Button
            variant={insuranceConfirmed ? "outline" : "default"}
            size="sm"
            onClick={() => setInsuranceConfirmed((v) => !v)}
          >
            {insuranceConfirmed ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Confirmed — click to revise
              </>
            ) : (
              "Confirm Insurance"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Section 3: Capacity */}
      <Card
        className={
          capacityConfirmed
            ? "border-green-200 dark:border-green-800 bg-green-50/30"
            : "hover:border-primary/40 transition-colors"
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${capacityConfirmed ? "bg-green-100 dark:bg-green-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
                <Users
                  className={`h-5 w-5 ${capacityConfirmed ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}
                />
              </div>
              <div>
                <CardTitle className="text-base">Capacity &amp; Availability</CardTitle>
                <CardDescription className="mt-0.5">
                  Confirm your current capacity to accept new engagements
                </CardDescription>
              </div>
            </div>
            {capacityConfirmed && (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1.5 mb-4">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              Your team or organisation has the capacity to fulfil engagements at current levels
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              Key personnel listed in your profile remain available and active
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
              Your availability status in the platform reflects your current situation
            </li>
          </ul>
          <Button
            variant={capacityConfirmed ? "outline" : "default"}
            size="sm"
            onClick={() => setCapacityConfirmed((v) => !v)}
          >
            {capacityConfirmed ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Confirmed — click to revise
              </>
            ) : (
              "Confirm Capacity"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Submit */}
      <Card className={allConfirmed ? "border-green-200 dark:border-green-800 bg-green-50/30" : ""}>
        <CardContent className="pt-4">
          {allConfirmed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-300">All sections confirmed</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your next refresh will be due in 12 months.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="shrink-0"
              >
                {submitMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Annual Refresh"
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">
                Please confirm all three sections above to submit your annual refresh.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

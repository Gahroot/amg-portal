"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Mail,
  Phone,
  Globe,
  MessageSquare,
  Languages,
  Info,
  Ban,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientCommunicationPreferences } from "@/hooks/use-communication-audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientPreferenceCardProps {
  clientId: string;
  compact?: boolean;
  onEditClick?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Channel icon map
// ---------------------------------------------------------------------------

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  portal: <Globe className="h-3.5 w-3.5" />,
  sms: <MessageSquare className="h-3.5 w-3.5" />,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return "";
  }
}

function isOutsideContactHours(
  timezone: string | null,
  hoursStart: string | null,
  hoursEnd: string | null,
): boolean {
  if (!timezone || !hoursStart || !hoursEnd) return false;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = parseInt(
      parts.find((p) => p.type === "minute")?.value ?? "0",
    );
    const currentMins = hour * 60 + minute;
    const [startH, startM] = hoursStart.split(":").map(Number);
    const [endH, endM] = hoursEnd.split(":").map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return currentMins < startMins || currentMins > endMins;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ClientPreferenceCard({
  clientId,
  compact = false,
  onEditClick,
  className,
}: ClientPreferenceCardProps) {
  const { data: preferences, isLoading } =
    useClientCommunicationPreferences(clientId);

  const [clientTime, setClientTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      if (!preferences?.contact_timezone) {
        setClientTime("");
        return;
      }
      setClientTime(getCurrentTimeInTimezone(preferences.contact_timezone));
    };
    updateTime();
    const interval = setInterval(updateTime, 60_000);
    return () => clearInterval(interval);
  }, [preferences?.contact_timezone]);

  const outsideHours = isOutsideContactHours(
    preferences?.contact_timezone ?? null,
    preferences?.contact_hours_start ?? null,
    preferences?.contact_hours_end ?? null,
  );

  const editHref = `/clients/${clientId}?tab=preferences`;

  const handleEdit = () => {
    if (onEditClick) {
      onEditClick();
    }
  };

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------

  if (isLoading) {
    if (compact) {
      return (
        <div className={`rounded-lg border p-3 space-y-2 ${className ?? ""}`}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      );
    }
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Compact mode
  // -------------------------------------------------------------------------

  if (compact) {
    return (
      <div className={`rounded-lg border p-3 space-y-2 ${className ?? ""}`}>
        {preferences?.do_not_contact && (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3 w-3" />
            Do Not Contact
          </Badge>
        )}
        {outsideHours && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-400 text-amber-700 bg-amber-50"
          >
            <AlertTriangle className="h-3 w-3" />
            Outside Preferred Hours
          </Badge>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {preferences?.contact_timezone && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {preferences.contact_timezone}
              {clientTime && ` · ${clientTime}`}
            </span>
          )}
          {preferences?.preferred_channels &&
            preferences.preferred_channels.length > 0 && (
              <span className="flex items-center gap-1">
                {preferences.preferred_channels.map((ch) => (
                  <span key={ch} className="flex items-center gap-0.5 capitalize">
                    {CHANNEL_ICONS[ch] ?? null}
                    {ch}
                  </span>
                ))}
              </span>
            )}
          {preferences?.language_preference && (
            <span className="flex items-center gap-1">
              <Languages className="h-3 w-3" />
              {preferences.language_preference}
            </span>
          )}
        </div>

        {onEditClick ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={handleEdit}
          >
            Edit preferences →
          </Button>
        ) : (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
            <Link href={editHref}>Edit preferences →</Link>
          </Button>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Full card mode
  // -------------------------------------------------------------------------

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="font-serif text-xl">
          Communication Preferences
        </CardTitle>
        {onEditClick ? (
          <Button size="sm" variant="outline" onClick={handleEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href={editHref}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {preferences?.do_not_contact && (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" />
            <AlertDescription className="font-medium">
              Do Not Contact — this client must not be contacted directly.
            </AlertDescription>
          </Alert>
        )}

        {outsideHours && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              Outside preferred contact hours — client&apos;s local time is{" "}
              <span className="font-semibold">{clientTime}</span>.
            </AlertDescription>
          </Alert>
        )}

        {!preferences ? (
          <p className="text-sm text-muted-foreground">
            No communication preferences set.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Timezone + live clock */}
            {preferences.contact_timezone && (
              <div className="flex items-start gap-2 text-sm">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <span className="font-medium">
                    {preferences.contact_timezone}
                  </span>
                  {clientTime && (
                    <span className="text-muted-foreground ml-2">
                      Current: {clientTime}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contact hours */}
            {preferences.contact_hours_start && preferences.contact_hours_end && (
              <div className="flex items-start gap-2 text-sm">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>
                  <span className="font-medium">Contact hours:</span>{" "}
                  {preferences.contact_hours_start} –{" "}
                  {preferences.contact_hours_end}
                  {preferences.contact_timezone && (
                    <span className="text-muted-foreground ml-1">
                      ({preferences.contact_timezone})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Preferred channels */}
            {preferences.preferred_channels &&
              preferences.preferred_channels.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1.5">
                    {preferences.preferred_channels.map((ch) => (
                      <Badge
                        key={ch}
                        variant="secondary"
                        className="gap-1 capitalize"
                      >
                        {CHANNEL_ICONS[ch] ?? null}
                        {ch}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

            {/* Language */}
            {preferences.language_preference && (
              <div className="flex items-start gap-2 text-sm">
                <Languages className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>
                  <span className="font-medium">Language:</span>{" "}
                  {preferences.language_preference}
                </span>
              </div>
            )}

            {/* Opt-out marketing */}
            {preferences.opt_out_marketing && (
              <div className="flex items-start gap-2 text-sm">
                <Ban className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  Opted out of marketing communications
                </span>
              </div>
            )}

            {/* Special instructions */}
            {preferences.special_instructions && (
              <div className="flex items-start gap-2 text-sm">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{preferences.special_instructions}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

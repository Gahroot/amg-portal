"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCalendarFeedStatus,
  createCalendarFeedToken,
  regenerateCalendarFeedToken,
  revokeCalendarFeedToken,
} from "@/lib/api/calendar-feed";
import type { CalendarFeedTokenCreated } from "@/types/calendar-feed";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Copy,
  RefreshCw,
  Ban,
  ExternalLink,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

export function CalendarFeed() {
  const queryClient = useQueryClient();
  const [newTokenData, setNewTokenData] = React.useState<CalendarFeedTokenCreated | null>(null);
  const [showUrl, setShowUrl] = React.useState(false);

  // Fetch calendar feed status
  const { data: statusData, isLoading } = useQuery({
    queryKey: ["calendar-feed-status"],
    queryFn: getCalendarFeedStatus,
  });

  // Create token mutation
  const createMutation = useMutation({
    mutationFn: createCalendarFeedToken,
    onSuccess: (data) => {
      setNewTokenData(data);
      queryClient.invalidateQueries({ queryKey: ["calendar-feed-status"] });
      toast.success("Calendar feed URL generated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create feed URL: ${error.message}`);
    },
  });

  // Regenerate token mutation
  const regenerateMutation = useMutation({
    mutationFn: regenerateCalendarFeedToken,
    onSuccess: (data) => {
      setNewTokenData(data);
      queryClient.invalidateQueries({ queryKey: ["calendar-feed-status"] });
      toast.success("Calendar feed URL regenerated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to regenerate feed URL: ${error.message}`);
    },
  });

  // Revoke token mutation
  const revokeMutation = useMutation({
    mutationFn: revokeCalendarFeedToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-feed-status"] });
      toast.success("Calendar feed access revoked");
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke feed URL: ${error.message}`);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getGoogleCalendarUrl = (feedUrl: string) => {
    // Google Calendar requires the URL to be publicly accessible
    // Format: https://calendar.google.com/calendar/r?cid=ENCODED_URL
    return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
  };

  const getOutlookUrl = (feedUrl: string) => {
    // Outlook.com: Add calendar from internet
    // Users need to manually add the URL in Outlook
    return "https://outlook.live.com/calendar/0/view/month";
  };

  return (
    <div className="space-y-6">
      {/* New Token Display Dialog */}
      <Dialog open={!!newTokenData} onOpenChange={(open) => !open && setNewTokenData(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Calendar Feed URL Created
            </DialogTitle>
            <DialogDescription>
              Please copy your feed URL now. You won&apos;t be able to see the full URL again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50/30 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-2">⚠️ Important Security Notice</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Store this URL securely - it provides access to your calendar</li>
                <li>Never share this URL or commit it to version control</li>
                <li>If compromised, regenerate the feed URL immediately</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label>Feed Name</Label>
              <Input value={newTokenData?.name || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Calendar Feed URL</Label>
              <div className="flex gap-2">
                <Input
                  type={showUrl ? "text" : "password"}
                  value={newTokenData?.feed_url || ""}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowUrl(!showUrl)}
                  title={showUrl ? "Hide URL" : "Show URL"}
                >
                  {showUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newTokenData?.feed_url || "")}
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p>{formatDate(newTokenData?.created_at || null)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Last Accessed</Label>
                <p>Never</p>
              </div>
            </div>

            {/* Quick Add Links */}
            <div className="pt-4 border-t">
              <Label className="text-muted-foreground mb-2 block">Quick Add to Calendar</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    copyToClipboard(newTokenData?.feed_url || "");
                    toast.info("URL copied! Open Google Calendar and add via URL");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Google Calendar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    copyToClipboard(newTokenData?.feed_url || "");
                    toast.info("URL copied! Open Outlook and add via Internet Calendar");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Outlook
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    copyToClipboard(newTokenData?.feed_url || "");
                    toast.info("URL copied! Open Apple Calendar and subscribe");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Apple Calendar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewTokenData(null)}>
              I&apos;ve Saved My URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendar Feed Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendar Feed
              </CardTitle>
              <CardDescription>
                Subscribe to your program calendar from external calendar apps like Google Calendar,
                Outlook, or Apple Calendar.
              </CardDescription>
            </div>
            {!statusData?.has_active_token && (
              <Button
                className="gap-2"
                onClick={() => createMutation.mutate(undefined)}
                disabled={createMutation.isPending}
              >
                <Link2 className="h-4 w-4" />
                Generate Feed URL
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading calendar feed status...
            </div>
          ) : !statusData?.has_active_token ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No calendar feed URL generated yet</p>
              <p className="text-sm">
                Generate a feed URL to subscribe to your program calendar in external apps.
              </p>
              <div className="mt-4 p-4 bg-muted rounded-lg text-left max-w-md mx-auto">
                <p className="font-medium mb-2">What&apos;s included:</p>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Program milestones
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Decision deadlines
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Scheduled meetings
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Token Info */}
              <div className="flex items-start justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{statusData.active_token?.name}</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created: {formatDate(statusData.active_token?.created_at || null)}
                    </span>
                    {statusData.active_token?.last_accessed_at && (
                      <span className="flex items-center gap-1">
                        Last accessed: {formatDate(statusData.active_token?.last_accessed_at)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => copyToClipboard(statusData.feed_url || "")}
                  >
                    <Copy className="h-4 w-4" />
                    Copy URL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => regenerateMutation.mutate(statusData.active_token?.id || "")}
                    disabled={regenerateMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 text-destructive">
                        <Ban className="h-4 w-4" />
                        Revoke
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Calendar Feed</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to revoke your calendar feed URL? Any calendar apps
                          using this URL will stop receiving updates immediately. You can generate a
                          new URL later if needed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => revokeMutation.mutate(statusData.active_token?.id || "")}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke Feed
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <h4 className="font-medium">How to subscribe:</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Google Calendar
                    </h5>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Open Google Calendar</li>
                      <li>Click &quot;+&quot; next to Other calendars</li>
                      <li>Select &quot;From URL&quot;</li>
                      <li>Paste the feed URL</li>
                      <li>Click &quot;Add calendar&quot;</li>
                    </ol>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Outlook
                    </h5>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Open Outlook Calendar</li>
                      <li>Click &quot;Add calendar&quot;</li>
                      <li>Select &quot;Subscribe from web&quot;</li>
                      <li>Paste the feed URL</li>
                      <li>Click &quot;Import&quot;</li>
                    </ol>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Apple Calendar
                    </h5>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Open Calendar app</li>
                      <li>File → New Calendar Subscription</li>
                      <li>Paste the feed URL</li>
                      <li>Click &quot;Subscribe&quot;</li>
                      <li>Set refresh interval</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

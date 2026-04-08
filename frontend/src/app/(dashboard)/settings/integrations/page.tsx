"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Zap,
  Layers,
  Webhook,
  Key,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  Code,
} from "lucide-react";

import {
  listPublicWebhooks,
  createPublicWebhook,
  deletePublicWebhook,
  type PublicWebhook,
} from "@/lib/api/public-webhooks";
import { listAPIKeys } from "@/lib/api/api-keys";

const EVENT_TYPES = [
  { value: "task.created", label: "Task Created", description: "When a new task is created" },
  { value: "task.updated", label: "Task Updated", description: "When a task is updated" },
  { value: "task.completed", label: "Task Completed", description: "When a task is marked complete" },
  { value: "assignment.created", label: "Assignment Created", description: "When a new assignment is created" },
  { value: "assignment.status_changed", label: "Assignment Status Changed", description: "When assignment status changes" },
  { value: "assignment.completed", label: "Assignment Completed", description: "When an assignment is completed" },
  { value: "program.created", label: "Program Created", description: "When a new program is created" },
  { value: "program.status_changed", label: "Program Status Changed", description: "When program status changes" },
  { value: "document.uploaded", label: "Document Uploaded", description: "When a document is uploaded" },
  { value: "document.approved", label: "Document Approved", description: "When a document is approved" },
  { value: "deliverable.submitted", label: "Deliverable Submitted", description: "When a deliverable is submitted" },
  { value: "deliverable.approved", label: "Deliverable Approved", description: "When a deliverable is approved" },
];

/** Extract an error message from an axios error or unknown error. */
function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export default function IntegrationsPage() {
  const [webhooks, setWebhooks] = React.useState<PublicWebhook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [newWebhook, setNewWebhook] = React.useState({
    url: "",
    description: "",
    events: [] as string[],
  });
  const [newSecret, setNewSecret] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [noApiKey, setNoApiKey] = React.useState(false);

  // Resolve the user's API key: prefer localStorage cache, fall back to fetching
  // the first active key's prefix (the full key is only available at creation time
  // and should have been saved to localStorage by the API keys manager).
  React.useEffect(() => {
    const stored = localStorage.getItem("api_key");
    if (stored) {
      setApiKey(stored);
      return;
    }

    // No cached key — check if the user has any active API keys and prompt them.
    listAPIKeys({ include_inactive: false, limit: 1 })
      .then((res) => {
        if (res.items.length === 0) {
          setNoApiKey(true);
        } else {
          // Key exists but is not stored locally — user needs to regenerate or
          // copy it from the API keys settings page.
          setNoApiKey(true);
        }
      })
      .catch(() => {
        setNoApiKey(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const fetchWebhooks = React.useCallback(async () => {
    if (!apiKey) return;
    try {
      setLoading(true);
      const data = await listPublicWebhooks(apiKey);
      setWebhooks(data.webhooks);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to fetch webhooks"));
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  React.useEffect(() => {
    if (apiKey) {
      fetchWebhooks();
    }
  }, [apiKey, fetchWebhooks]);

  const handleCreateWebhook = async () => {
    if (!apiKey) return;
    try {
      const webhook = await createPublicWebhook(apiKey, {
        url: newWebhook.url,
        events: newWebhook.events,
        description: newWebhook.description || undefined,
      });
      setNewSecret(webhook.secret);
      setNewWebhook({ url: "", description: "", events: [] });
      toast.success("Webhook created! Copy the secret now — it won't be shown again.");
      await fetchWebhooks();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create webhook"));
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!apiKey) return;
    try {
      await deletePublicWebhook(apiKey, id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success("Webhook deleted");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete webhook"));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleEvent = (event: string) => {
    if (newWebhook.events.includes(event)) {
      setNewWebhook({
        ...newWebhook,
        events: newWebhook.events.filter((e) => e !== event),
      });
    } else {
      setNewWebhook({
        ...newWebhook,
        events: [...newWebhook.events, event],
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect AMG Portal with external services and automation platforms.
        </p>
      </div>

      {noApiKey && !apiKey && (
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 p-4 text-sm text-yellow-700 dark:text-yellow-300">
          <p className="font-medium">API key required</p>
          <p className="mt-1">
            You need an active API key to manage webhooks.{" "}
            <Link href="/settings" className="underline font-medium">
              Create or copy one from Settings → API Keys
            </Link>
            , then reload this page.
          </p>
        </div>
      )}

      <Tabs defaultValue="platforms" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Zapier Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100/30 dark:bg-orange-900">
                    <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <CardTitle>Zapier</CardTitle>
                    <CardDescription>Connect with 6000+ apps</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Automate workflows between AMG Portal and your favorite apps.
                  Create Zaps that trigger on task creation, status changes, and more.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">Triggers</Badge>
                  <Badge variant="secondary">Actions</Badge>
                  <Badge variant="secondary">Polling</Badge>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/docs/integrations#zapier-integration" target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Setup Guide
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Make Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100/30 dark:bg-purple-900">
                    <Layers className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle>Make (Integromat)</CardTitle>
                    <CardDescription>Advanced automation</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Build complex multi-step scenarios with conditional logic,
                  data transformation, and scheduling.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">Scenarios</Badge>
                  <Badge variant="secondary">Webhooks</Badge>
                  <Badge variant="secondary">Scheduling</Badge>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/docs/integrations#make-integromat-integration" target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Setup Guide
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* API Access Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100/30 dark:bg-blue-900">
                  <Code className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Direct API Access</CardTitle>
                  <CardDescription>Build custom integrations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Use our REST API to build custom integrations with any platform.
                Full OpenAPI documentation is available.
              </p>
              <div className="rounded-md bg-muted p-4">
                <code className="text-sm">
                  GET /api/v1/public/poll/tasks
                </code>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" asChild>
                <Link href="/settings">
                  <Key className="mr-2 h-4 w-4" />
                  Manage API Keys
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/api/v1/docs" target="_blank">
                  <FileText className="mr-2 h-4 w-4" />
                  API Docs
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Webhook className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle>Webhook Subscriptions</CardTitle>
                    <CardDescription>
                      Receive real-time notifications when events occur
                    </CardDescription>
                  </div>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={!apiKey}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Webhook
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create Webhook</DialogTitle>
                      <DialogDescription>
                        Configure a webhook to receive event notifications.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="url">Webhook URL</Label>
                        <Input
                          id="url"
                          placeholder="https://your-app.com/webhooks/amg"
                          value={newWebhook.url}
                          onChange={(e) =>
                            setNewWebhook({ ...newWebhook, url: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description (optional)</Label>
                        <Input
                          id="description"
                          placeholder="Production webhook for Slack notifications"
                          value={newWebhook.description}
                          onChange={(e) =>
                            setNewWebhook({ ...newWebhook, description: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Events to Subscribe</Label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {EVENT_TYPES.map((event) => (
                            <div key={event.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={event.value}
                                checked={newWebhook.events.includes(event.value)}
                                onCheckedChange={() => toggleEvent(event.value)}
                              />
                              <Label htmlFor={event.value} className="text-sm font-normal">
                                {event.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          handleCreateWebhook();
                          setCreateDialogOpen(false);
                        }}
                        disabled={!newWebhook.url || newWebhook.events.length === 0}
                      >
                        Create
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No webhooks configured</p>
                  <p className="text-sm">Click &quot;Add Webhook&quot; to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {webhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className="flex items-start justify-between p-4 rounded-lg border"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{webhook.description || "Webhook"}</p>
                          {webhook.is_active ? (
                            <Badge variant="outline" className="text-green-600 dark:text-green-400">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 dark:text-red-400">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">
                          {webhook.url}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 dark:text-red-400"
                        onClick={() => handleDeleteWebhook(webhook.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* New Secret Display */}
          {newSecret && (
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="text-green-600 dark:text-green-400">Webhook Secret</CardTitle>
                <CardDescription>
                  Copy this secret now - it won&apos;t be shown again!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-sm overflow-x-auto">
                    {newSecret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newSecret)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={() => setNewSecret(null)}>
                  Done
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integration Documentation</CardTitle>
              <CardDescription>
                Learn how to set up integrations with external services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <a
                  href="/docs/integrations.md"
                  target="_blank"
                  className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">Full Documentation</p>
                    <p className="text-sm text-muted-foreground">
                      Complete guide for all integration methods
                    </p>
                  </div>
                </a>
                <a
                  href="/api/v1/docs"
                  target="_blank"
                  className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <Code className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium">API Reference</p>
                    <p className="text-sm text-muted-foreground">
                      OpenAPI documentation for the public API
                    </p>
                  </div>
                </a>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-medium mb-2">Quick Links</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/docs/integrations#zapier-integration" className="hover:text-foreground">
                      → Zapier Setup Guide
                    </Link>
                  </li>
                  <li>
                    <Link href="/docs/integrations#make-integromat-integration" className="hover:text-foreground">
                      → Make (Integromat) Setup Guide
                    </Link>
                  </li>
                  <li>
                    <Link href="/docs/integrations#webhooks" className="hover:text-foreground">
                      → Webhook Configuration
                    </Link>
                  </li>
                  <li>
                    <Link href="/docs/integrations#event-types-reference" className="hover:text-foreground">
                      → Event Types Reference
                    </Link>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

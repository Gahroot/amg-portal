"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Edit,
  Send,
  Eye,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  getWebhooks,
  getWebhookEventTypes,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  type Webhook,
  type WebhookEventType,
  type WebhookCreateRequest,
  type WebhookUpdateRequest,
  type WebhookDelivery,
  type WebhookTestResponse,
} from "@/lib/api/webhooks";

const EVENT_TYPE_LABELS: Record<string, string> = {
  "assignment.created": "Assignment Created",
  "assignment.accepted": "Assignment Accepted",
  "assignment.completed": "Assignment Completed",
  "deliverable.uploaded": "Deliverable Uploaded",
  "payment.processed": "Payment Processed",
};

export default function PartnerWebhooksPage() {
  const [webhooks, setWebhooks] = React.useState<Webhook[]>([]);
  const [eventTypes, setEventTypes] = React.useState<WebhookEventType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showInactive, setShowInactive] = React.useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showTestDialog, setShowTestDialog] = React.useState(false);
  const [showDeliveriesSheet, setShowDeliveriesSheet] = React.useState(false);

  // Selected webhook for operations
  const [selectedWebhook, setSelectedWebhook] = React.useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = React.useState<WebhookDelivery[]>([]);
  const [testResult, setTestResult] = React.useState<WebhookTestResponse | null>(null);
  const [testEventType, setTestEventType] = React.useState<string>("");

  // Form state
  const [formData, setFormData] = React.useState<WebhookCreateRequest>({
    url: "",
    secret: "",
    events: [],
    description: "",
  });
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

  const loadWebhooks = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getWebhooks({ include_inactive: showInactive });
      setWebhooks(response.webhooks);
    } catch (error) {
      toast.error("Failed to load webhooks");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

  const loadEventTypes = React.useCallback(async () => {
    try {
      const response = await getWebhookEventTypes();
      setEventTypes(response.event_types);
    } catch (error) {
      console.error("Failed to load event types:", error);
    }
  }, []);

  React.useEffect(() => {
    loadWebhooks();
    loadEventTypes();
  }, [loadWebhooks, loadEventTypes]);

  const resetForm = () => {
    setFormData({
      url: "",
      secret: "",
      events: [],
      description: "",
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.url) {
      errors.url = "URL is required";
    } else if (!/^https:\/\//i.test(formData.url)) {
      errors.url = "URL must start with https://";
    }

    if (!formData.secret || formData.secret.length < 8) {
      errors.secret = "Secret must be at least 8 characters";
    }

    if (formData.events.length === 0) {
      errors.events = "At least one event type must be selected";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      await createWebhook(formData);
      toast.success("Webhook created successfully");
      setShowCreateDialog(false);
      resetForm();
      loadWebhooks();
    } catch (error) {
      toast.error("Failed to create webhook");
      console.error(error);
    }
  };

  const handleEdit = async () => {
    if (!selectedWebhook) return;
    if (!validateForm()) return;

    const updateData: WebhookUpdateRequest = {};
    if (formData.url !== selectedWebhook.url) updateData.url = formData.url;
    if (formData.secret) updateData.secret = formData.secret;
    if (JSON.stringify(formData.events.sort()) !== JSON.stringify(selectedWebhook.events.sort())) {
      updateData.events = formData.events;
    }
    if (formData.description !== (selectedWebhook.description ?? "")) {
      updateData.description = formData.description;
    }

    try {
      await updateWebhook(selectedWebhook.id, updateData);
      toast.success("Webhook updated successfully");
      setShowEditDialog(false);
      setSelectedWebhook(null);
      resetForm();
      loadWebhooks();
    } catch (error) {
      toast.error("Failed to update webhook");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!selectedWebhook) return;

    try {
      await deleteWebhook(selectedWebhook.id);
      toast.success("Webhook deleted successfully");
      setShowDeleteDialog(false);
      setSelectedWebhook(null);
      loadWebhooks();
    } catch (error) {
      toast.error("Failed to delete webhook");
      console.error(error);
    }
  };

  const handleToggleActive = async (webhook: Webhook) => {
    try {
      await updateWebhook(webhook.id, { is_active: !webhook.is_active });
      toast.success(webhook.is_active ? "Webhook disabled" : "Webhook enabled");
      loadWebhooks();
    } catch (error) {
      toast.error("Failed to update webhook status");
      console.error(error);
    }
  };

  const handleTest = async () => {
    if (!selectedWebhook || !testEventType) return;

    try {
      const result = await testWebhook(selectedWebhook.id, { event_type: testEventType });
      setTestResult(result);
      if (result.success) {
        toast.success("Test webhook sent successfully");
      } else {
        toast.error("Test webhook failed");
      }
    } catch (error) {
      toast.error("Failed to send test webhook");
      console.error(error);
    }
  };

  const handleViewDeliveries = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    try {
      const response = await getWebhookDeliveries(webhook.id, { limit: 50 });
      setDeliveries(response.deliveries);
      setShowDeliveriesSheet(true);
    } catch (error) {
      toast.error("Failed to load delivery logs");
      console.error(error);
    }
  };

  const openEditDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setFormData({
      url: webhook.url,
      secret: "",
      events: [...webhook.events],
      description: webhook.description ?? "",
    });
    setShowEditDialog(true);
  };

  const openTestDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setTestEventType(webhook.events[0] ?? "");
    setTestResult(null);
    setShowTestDialog(true);
  };

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusBadge = (webhook: Webhook) => {
    if (!webhook.is_active) {
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Disabled
        </Badge>
      );
    }
    if (webhook.failure_count >= 10) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Auto-disabled
        </Badge>
      );
    }
    if (webhook.failure_count > 0) {
      return (
        <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600 dark:text-yellow-400">
          <AlertCircle className="h-3 w-3" />
          {webhook.failure_count} failures
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle className="h-3 w-3" />
        Active
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    return format(new Date(timestamp), "MMM d, yyyy HH:mm");
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>
                  Configure webhooks to receive real-time notifications about assignment updates.
                </CardDescription>
              </div>
              <Button onClick={() => {
                resetForm();
                setShowCreateDialog(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Webhook
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="mb-4 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showInactive}
                  onCheckedChange={(checked) => setShowInactive(checked === true)}
                />
                Show inactive webhooks
              </label>
            </div>

            {/* Webhooks List */}
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading webhooks...</p>
            ) : webhooks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">No webhooks configured</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a webhook to receive real-time notifications about your assignments.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Last Triggered</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(webhook)}
                            {webhook.secret_hint && (
                              <span className="text-xs text-muted-foreground">
                                Secret: {webhook.secret_hint}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="max-w-[200px] truncate font-mono text-sm">
                                {webhook.url}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-[300px] break-all">{webhook.url}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.slice(0, 2).map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {EVENT_TYPE_LABELS[event] ?? event}
                              </Badge>
                            ))}
                            {webhook.events.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{webhook.events.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatTimestamp(webhook.last_triggered_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(webhook)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openTestDialog(webhook)}>
                                <Send className="mr-2 h-4 w-4" />
                                Test
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewDeliveries(webhook)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Logs
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleActive(webhook)}>
                                {webhook.is_active ? (
                                  <>
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Enable
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedWebhook(webhook);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Webhook Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a new webhook to receive notifications about assignment updates.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {formErrors.root && (
                <Alert variant="destructive">
                  <AlertDescription>{formErrors.root}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="url">Webhook URL *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://your-server.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                />
                {formErrors.url && (
                  <p className="text-sm text-destructive">{formErrors.url}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  The endpoint where we&apos;ll send POST requests. Must use HTTPS.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">Signing Secret *</Label>
                <Input
                  id="secret"
                  type="password"
                  placeholder="Enter a secret (min 8 characters)"
                  value={formData.secret}
                  onChange={(e) => setFormData((prev) => ({ ...prev, secret: e.target.value }))}
                />
                {formErrors.secret && (
                  <p className="text-sm text-destructive">{formErrors.secret}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Used to sign webhook payloads. Keep this secret safe.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Events to Subscribe *</Label>
                <div className="space-y-2">
                  {eventTypes.map((eventType) => (
                    <label key={eventType.type} className="flex items-start gap-2">
                      <Checkbox
                        checked={formData.events.includes(eventType.type)}
                        onCheckedChange={() => toggleEvent(eventType.type)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          {EVENT_TYPE_LABELS[eventType.type] ?? eventType.type}
                        </span>
                        <p className="text-xs text-muted-foreground">{eventType.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {formErrors.events && (
                  <p className="text-sm text-destructive">{formErrors.events}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What is this webhook for?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Webhook</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Webhook Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Webhook</DialogTitle>
              <DialogDescription>
                Update webhook configuration. Leave the secret blank to keep the current secret.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-url">Webhook URL *</Label>
                <Input
                  id="edit-url"
                  type="url"
                  placeholder="https://your-server.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                />
                {formErrors.url && (
                  <p className="text-sm text-destructive">{formErrors.url}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-secret">New Secret (leave blank to keep current)</Label>
                <Input
                  id="edit-secret"
                  type="password"
                  placeholder="Enter a new secret (min 8 characters)"
                  value={formData.secret}
                  onChange={(e) => setFormData((prev) => ({ ...prev, secret: e.target.value }))}
                />
                {selectedWebhook?.secret_hint && (
                  <p className="text-xs text-muted-foreground">
                    Current secret: {selectedWebhook.secret_hint}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Events to Subscribe *</Label>
                <div className="space-y-2">
                  {eventTypes.map((eventType) => (
                    <label key={eventType.type} className="flex items-start gap-2">
                      <Checkbox
                        checked={formData.events.includes(eventType.type)}
                        onCheckedChange={() => toggleEvent(eventType.type)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          {EVENT_TYPE_LABELS[eventType.type] ?? eventType.type}
                        </span>
                        <p className="text-xs text-muted-foreground">{eventType.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {formErrors.events && (
                  <p className="text-sm text-destructive">{formErrors.events}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Textarea
                  id="edit-description"
                  placeholder="What is this webhook for?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Webhook Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Webhook</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this webhook? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedWebhook && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="font-mono text-sm">{selectedWebhook.url}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Subscribed to {selectedWebhook.events.length} event(s)
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Webhook Dialog */}
        <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Test Webhook</DialogTitle>
              <DialogDescription>
                Send a test payload to your webhook endpoint.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Event Type</Label>
                <div className="flex gap-2">
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={testEventType}
                    onChange={(e) => setTestEventType(e.target.value)}
                  >
                    {selectedWebhook?.events.map((event) => (
                      <option key={event} value={event}>
                        {EVENT_TYPE_LABELS[event] ?? event}
                      </option>
                    ))}
                  </select>
                  <Button onClick={handleTest} disabled={!testEventType}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test
                  </Button>
                </div>
              </div>

              {testResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <Badge className="bg-green-600">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Success ({testResult.status_code})
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        Failed
                      </Badge>
                    )}
                    {testResult.duration_ms !== null && (
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(testResult.duration_ms)}
                      </span>
                    )}
                  </div>

                  {testResult.error_message && (
                    <Alert variant="destructive">
                      <AlertDescription>{testResult.error_message}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Test Payload</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(testResult.payload)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                    <pre className="max-h-[200px] overflow-auto rounded-lg bg-muted p-3 text-xs">
                      {JSON.stringify(JSON.parse(testResult.payload), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTestDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delivery Logs Sheet */}
        <Sheet open={showDeliveriesSheet} onOpenChange={setShowDeliveriesSheet}>
          <SheetContent className="w-[600px] sm:max-w-[600px]">
            <SheetHeader>
              <SheetTitle>Delivery Logs</SheetTitle>
              <SheetDescription>
                Recent webhook delivery attempts for{" "}
                {selectedWebhook && (
                  <span className="font-mono text-xs">{selectedWebhook.url}</span>
                )}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="mt-4 h-[calc(100vh-150px)]">
              {deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No delivery logs yet.</p>
              ) : (
                <div className="space-y-3">
                  {deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {delivery.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <Badge variant="outline" className="text-xs">
                            {EVENT_TYPE_LABELS[delivery.event_type] ?? delivery.event_type}
                          </Badge>
                          {delivery.status_code && (
                            <span className="text-xs text-muted-foreground">
                              HTTP {delivery.status_code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(delivery.created_at)}
                          {delivery.duration_ms !== null && (
                            <span>({formatDuration(delivery.duration_ms)})</span>
                          )}
                        </div>
                      </div>

                      {delivery.error_message && (
                        <p className="mt-2 text-xs text-destructive">
                          {delivery.error_message}
                        </p>
                      )}

                      {delivery.attempt_number > 1 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Attempt #{delivery.attempt_number}
                        </p>
                      )}

                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          View Payload
                        </summary>
                        <pre className="mt-2 max-h-[150px] overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(JSON.parse(delivery.payload), null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

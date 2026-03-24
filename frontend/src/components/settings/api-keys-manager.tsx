"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAPIKeys,
  createAPIKey,
  revokeAPIKey,
  regenerateAPIKey,
  deleteAPIKey,
} from "@/lib/api/api-keys";
import { API_KEY_SCOPES, SCOPE_CATEGORIES, type APIKey, type APIKeyCreated } from "@/types/api-key";
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
  DialogTrigger,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Key,
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Ban,
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

export function APIKeysManager() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newKeyData, setNewKeyData] = React.useState<APIKeyCreated | null>(null);
  const [showKey, setShowKey] = React.useState(false);

  // Form state
  const [keyName, setKeyName] = React.useState("");
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>(["read:clients", "read:programs"]);
  const [expiresInDays, setExpiresInDays] = React.useState<string>("never");
  const [rateLimit, setRateLimit] = React.useState<string>("60");

  // Fetch API keys
  const { data: keysData, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => listAPIKeys({ include_inactive: false }),
  });

  // Create key mutation
  const createMutation = useMutation({
    mutationFn: createAPIKey,
    onSuccess: (data) => {
      setNewKeyData(data);
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create API key: ${error.message}`);
    },
  });

  // Revoke key mutation
  const revokeMutation = useMutation({
    mutationFn: revokeAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke API key: ${error.message}`);
    },
  });

  // Regenerate key mutation
  const regenerateMutation = useMutation({
    mutationFn: regenerateAPIKey,
    onSuccess: (data) => {
      setNewKeyData(data);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key regenerated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to regenerate API key: ${error.message}`);
    },
  });

  // Delete key mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete API key: ${error.message}`);
    },
  });

  const resetForm = () => {
    setKeyName("");
    setSelectedScopes(["read:clients", "read:programs"]);
    setExpiresInDays("never");
    setRateLimit("60");
  };

  const handleCreateKey = () => {
    if (!keyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error("Please select at least one scope");
      return;
    }

    createMutation.mutate({
      name: keyName.trim(),
      scopes: selectedScopes,
      expires_in_days: expiresInDays === "never" ? null : parseInt(expiresInDays, 10),
      rate_limit: rateLimit === "default" ? null : parseInt(rateLimit, 10),
    });
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

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
    });
  };

  const isExpired = (key: APIKey) => {
    if (!key.expires_at) return false;
    return new Date(key.expires_at) < new Date();
  };

  const getKeyStatus = (key: APIKey) => {
    if (!key.is_active) return { label: "Revoked", variant: "destructive" as const };
    if (isExpired(key)) return { label: "Expired", variant: "secondary" as const };
    return { label: "Active", variant: "default" as const };
  };

  return (
    <div className="space-y-6">
      {/* New Key Display Dialog */}
      <Dialog open={!!newKeyData} onOpenChange={(open) => !open && setNewKeyData(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Please copy your API key now. You won&apos;t be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-2">⚠️ Important Security Notice</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Store this key securely - it cannot be retrieved later</li>
                <li>Never share your API key or commit it to version control</li>
                <li>If lost, you&apos;ll need to regenerate a new key</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input value={newKeyData?.name || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  value={newKeyData?.key || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newKeyData?.key || "")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-1">
                {newKeyData?.scopes.map((scope) => (
                  <Badge key={scope} variant="outline" className="text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Expires</Label>
                <p>{formatDate(newKeyData?.expires_at || null)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p>{formatDate(newKeyData?.created_at || null)}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyData(null)}>
              I&apos;ve Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Keys Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Manage API keys for programmatic access to your account.
              </CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for programmatic access. Choose scopes carefully.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g., Production Integration"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      A descriptive name to help you identify this key later.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Scopes</Label>
                    <ScrollArea className="h-48 rounded-md border p-4">
                      {Object.entries(SCOPE_CATEGORIES).map(([category, scopes]) => (
                        <div key={category} className="mb-4 last:mb-0">
                          <h4 className="mb-2 text-sm font-medium">{category}</h4>
                          <div className="space-y-2">
                            {scopes.map((scope) => (
                              <div key={scope} className="flex items-start gap-2">
                                <Checkbox
                                  id={scope}
                                  checked={selectedScopes.includes(scope)}
                                  onCheckedChange={() => toggleScope(scope)}
                                />
                                <div className="grid gap-0.5 leading-none">
                                  <Label htmlFor={scope} className="text-sm font-normal cursor-pointer">
                                    {scope}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {API_KEY_SCOPES[scope]}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground">
                      {selectedScopes.length} scope(s) selected
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Expires In</Label>
                      <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rate Limit (requests/min)</Label>
                      <Select value={rateLimit} onValueChange={setRateLimit}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="60">60 (default)</SelectItem>
                          <SelectItem value="120">120</SelectItem>
                          <SelectItem value="300">300</SelectItem>
                          <SelectItem value="default">No limit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading API keys...</div>
          ) : !keysData?.items.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys yet</p>
              <p className="text-sm">Create your first API key to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keysData.items.map((key) => {
                  const status = getKeyStatus(key);
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {key.key_prefix}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {key.scopes.slice(0, 2).map((scope) => (
                            <Badge key={scope} variant="outline" className="text-xs">
                              {scope}
                            </Badge>
                          ))}
                          {key.scopes.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{key.scopes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(key.last_used_at)}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(key.expires_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {key.is_active && !isExpired(key) && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Regenerate key"
                                onClick={() => regenerateMutation.mutate(key.id)}
                                disabled={regenerateMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" title="Revoke key">
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to revoke &quot;{key.name}&quot;? This action
                                      cannot be undone. Any applications using this key will lose
                                      access immediately.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => revokeMutation.mutate(key.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Revoke Key
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Delete key">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Permanently delete &quot;{key.name}&quot;? This removes it from your
                                  account history.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(key.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

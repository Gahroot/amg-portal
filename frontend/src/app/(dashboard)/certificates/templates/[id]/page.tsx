"use client";

import {
  useState,
  useEffect,
  useRef,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Eye,
  FileText,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  getTemplate,
  updateTemplate,
  previewCertificate,
  type CertificateTemplate,
  type CertificateTemplateType,
} from "@/lib/api/clearance-certificates";
import { toast } from "sonner";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function TemplateSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton className="h-[600px] w-full rounded-lg" />
        <Skeleton className="h-[600px] w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─── Preview with Data Dialog ────────────────────────────────────────────────

interface PreviewDialogProps {
  open: boolean;
  onClose: () => void;
  templateId: string;
  templateType: CertificateTemplateType;
}

function PreviewWithDataDialog({
  open,
  onClose,
  templateId,
  templateType,
}: PreviewDialogProps) {
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!clientId.trim()) {
      toast.error("Please enter a client ID");
      return;
    }
    setLoading(true);
    try {
      const result = await previewCertificate({
        template_id: templateId,
        client_id: clientId.trim(),
        certificate_type: templateType,
      });
      setPreviewHtml(result.content);
    } catch {
      toast.error("Failed to generate preview. Check the client ID and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setClientId("");
    setPreviewHtml(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Preview with Live Data
          </DialogTitle>
          <DialogDescription>
            Populate template placeholders with real client data to see how the
            final certificate will look.
          </DialogDescription>
        </DialogHeader>

        {!previewHtml ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="preview-client-id">Client ID</Label>
              <Input
                id="preview-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter a client UUID to populate placeholders…"
                onKeyDown={(e) => e.key === "Enter" && handlePreview()}
              />
              <p className="text-xs text-muted-foreground">
                The client&apos;s data will be used to fill template placeholders.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={loading}>
                {loading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Generate Preview
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            <div className="flex-1 overflow-hidden rounded-md border bg-card min-h-[400px]">
              <iframe
                srcDoc={previewHtml}
                title="Certificate preview with data"
                className="h-full w-full"
                sandbox="allow-same-origin"
                style={{ minHeight: "450px" }}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPreviewHtml(null)}
              >
                Change Client
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TemplateEditPage() {
  const params = useParams();
  const { user } = useAuth();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [content, setContent] = useState("");

  // Live preview: debounce content updates to the iframe
  const [previewContent, setPreviewContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewContent(content);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content]);

  // Load template
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getTemplate(templateId);
        setTemplate(data);
        setName(data.name);
        setDescription(data.description ?? "");
        setIsActive(data.is_active);
        setContent(data.content);
        setPreviewContent(data.content);
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [templateId]);

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    try {
      const updated = await updateTemplate(templateId, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        content: content || undefined,
        is_active: isActive,
      });
      setTemplate(updated);
      toast.success("Template saved successfully");
    } catch {
      toast.error("Failed to save template. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Guards ──────────────────────────────────────────────────────────────

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <TemplateSkeleton />;
  }

  if (notFound || !template) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/certificates/templates">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Templates
            </Link>
          </Button>
        </div>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-muted p-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-semibold">
              Template Not Found
            </h2>
            <p className="text-muted-foreground mt-1">
              The template you&apos;re looking for doesn&apos;t exist or has
              been deleted.
            </p>
          </div>
          <Button asChild>
            <Link href="/certificates/templates">Return to Templates</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="-ml-2">
                <Link href="/certificates/templates">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Templates
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                {template.name}
              </h1>
              <Badge
                variant={template.is_active ? "default" : "secondary"}
                className="capitalize"
              >
                {template.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {template.template_type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground pl-9">
              Last updated{" "}
              {new Date(template.updated_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-7 shrink-0">
            <Button
              variant="outline"
              onClick={() => setPreviewDialogOpen(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview with Data
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Template
            </Button>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* ── Left: Edit Form ─────────────────────────────────────────── */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-base font-semibold tracking-wide uppercase text-muted-foreground">
                Template Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="template-name" className="font-medium">
                  Name
                </Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Program Completion Certificate"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="template-description" className="font-medium">
                  Description
                  <span className="ml-1 font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="template-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe this template's purpose…"
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Template Type (read-only — not editable via API) */}
              <div className="space-y-1.5">
                <Label className="font-medium">Template Type</Label>
                <Select value={template.template_type} disabled>
                  <SelectTrigger className="bg-muted/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="program">Program</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Template type cannot be changed after creation.
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="template-active" className="font-medium cursor-pointer">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only active templates can be used when creating new
                    certificates.
                  </p>
                </div>
                <Switch
                  id="template-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              {/* Content editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template-content" className="font-medium">
                    HTML Content
                  </Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {content.length.toLocaleString()} chars
                  </span>
                </div>
                <Textarea
                  id="template-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the HTML template body…"
                  rows={18}
                  className="font-mono text-sm resize-y min-h-[320px] bg-muted/20"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  Use{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {"{{placeholder_name}}"}
                  </code>{" "}
                  syntax for dynamic values. The live preview updates as you
                  type.
                </p>
              </div>

              {/* Save button (also in header, mirrored here for convenience) */}
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Template
              </Button>
            </CardContent>
          </Card>

          {/* ── Right: Live Preview ──────────────────────────────────────── */}
          <div className="sticky top-6 space-y-3">
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold tracking-wide uppercase text-muted-foreground">
                    Live Preview
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewDialogOpen(true)}
                    className="text-xs"
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Preview with Data
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {previewContent.trim() ? (
                  <iframe
                    key={previewContent}
                    srcDoc={previewContent}
                    title="Template live preview"
                    className="w-full border-0"
                    style={{ height: "620px" }}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex h-[620px] flex-col items-center justify-center gap-3 text-center px-8">
                    <div className="rounded-full bg-muted/60 p-5">
                      <FileText className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">
                        No content yet
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-0.5">
                        Start typing HTML in the content field and the preview
                        will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              This preview renders the raw template — placeholders will appear
              as-is. Use{" "}
              <button
                onClick={() => setPreviewDialogOpen(true)}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Preview with Data
              </button>{" "}
              to populate them with real client information.
            </p>
          </div>
        </div>
      </div>

      {/* Preview with Data dialog */}
      <PreviewWithDataDialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        templateId={templateId}
        templateType={template.template_type}
      />
    </>
  );
}

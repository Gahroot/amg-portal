"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCertificateTemplates,
  usePreviewCertificate,
  useCreateCertificate,
} from "@/hooks/use-certificates";
import { useClients } from "@/hooks/use-clients";
import { usePrograms } from "@/hooks/use-programs";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const CERTIFICATE_TYPES = [
  { value: "program_completion", label: "Program Completion" },
  { value: "compliance_review", label: "Compliance Review" },
  { value: "client_clearance", label: "Client Clearance" },
  { value: "general", label: "General" },
];

export default function NewCertificatePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Form state
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>("");
  const [selectedClient, setSelectedClient] = React.useState<string>("");
  const [selectedProgram, setSelectedProgram] = React.useState<string>("");
  const [certificateType, setCertificateType] = React.useState<string>("general");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [previewContent, setPreviewContent] = React.useState("");

  // Data hooks
  const { data: templatesData } = useCertificateTemplates({ is_active: true });
  const { data: clientsData } = useClients({ limit: 100 });
  const { data: programsData } = usePrograms(
    selectedClient ? { client_id: selectedClient, limit: 100 } : undefined
  );

  // Mutation hooks
  const previewMutation = usePreviewCertificate();
  const createMutation = useCreateCertificate();

  // Derived data
  const templates = templatesData?.templates ?? [];
  const clients = clientsData?.clients ?? [];
  const programs = programsData?.programs ?? [];

  const handlePreview = async () => {
    if (!selectedClient) return;

    previewMutation.mutate(
      {
        template_id: selectedTemplate || undefined,
        program_id: selectedProgram || undefined,
        client_id: selectedClient,
        certificate_type: certificateType,
        title: title || undefined,
      },
      {
        onSuccess: (response) => {
          setPreviewContent(response.content);
          if (!title) {
            setTitle(response.title);
          }
        },
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !title) return;

    createMutation.mutate(
      {
        template_id: selectedTemplate || undefined,
        program_id: selectedProgram || undefined,
        client_id: selectedClient,
        title,
        content: content || undefined,
        certificate_type: certificateType,
      },
      {
        onSuccess: (certificate) => {
          router.push(`/certificates/${certificate.id}`);
        },
      }
    );
  };

  const isLoading = createMutation.isPending;
  const isPreviewLoading = previewMutation.isPending;

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            New Certificate
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new compliance clearance certificate
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/certificates")}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Certificate Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template">Template (optional)</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (use default)</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="program">Program (optional)</Label>
                  <Select
                    value={selectedProgram}
                    onValueChange={setSelectedProgram}
                    disabled={!selectedClient}
                  >
                    <SelectTrigger id="program">
                      <SelectValue placeholder="Select a program" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Certificate Type *</Label>
                  <Select value={certificateType} onValueChange={setCertificateType}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CERTIFICATE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Certificate title"
                    required
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!selectedClient || isPreviewLoading}
                >
                  {isPreviewLoading ? "Loading..." : "Preview Content"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Content (optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Leave empty to use template content, or enter custom HTML content..."
                  className="min-h-32 font-mono text-sm"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/certificates")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedClient || !title || isLoading}>
                {isLoading ? "Creating..." : "Create Draft"}
              </Button>
            </div>
          </div>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {previewContent ? (
                <div
                  className="prose prose-sm max-w-none border rounded-lg p-4 bg-white min-h-96"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              ) : (
                <div className="flex items-center justify-center h-96 text-muted-foreground border rounded-lg">
                  Select a client and click &quot;Preview Content&quot; to see a preview
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

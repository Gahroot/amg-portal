"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Eye, Send, Loader2, RefreshCw } from "lucide-react";
import { useTemplates, usePreviewTemplate, useSendFromTemplate } from "@/hooks/use-templates";
import type { CommunicationTemplate, TemplatePreviewResponse } from "@/types/communication";

interface TemplateComposeContext {
  client_name?: string;
  program_title?: string;
  rm_name?: string;
  client_id?: string;
  program_id?: string;
  [key: string]: string | undefined;
}

interface TemplateComposeProps {
  /** IDs of users who will receive the message */
  recipientUserIds: string[];
  /** Optional context for auto-filling template variables */
  context?: TemplateComposeContext;
  /** Called after a message is sent successfully */
  onSent?: () => void;
}

export function TemplateCompose({
  recipientUserIds,
  context = {},
  onSent,
}: TemplateComposeProps) {
  const { data: templatesData, isLoading: isLoadingTemplates } = useTemplates();
  const previewMutation = usePreviewTemplate();
  const sendMutation = useSendFromTemplate();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<TemplatePreviewResponse | null>(null);

  const selectedTemplate: CommunicationTemplate | undefined =
    templatesData?.templates.find((t) => t.id === selectedTemplateId);

  // Build auto-filled variables from context for a given template
  const buildAutoFill = useCallback(
    (template: CommunicationTemplate): Record<string, string> => {
      if (!template.variable_definitions) return {};
      const filled: Record<string, string> = {};
      for (const varName of Object.keys(template.variable_definitions)) {
        const contextValue = context[varName];
        if (contextValue !== undefined) {
          filled[varName] = contextValue;
        }
      }
      return filled;
    },
    [context]
  );

  // Handle template selection: reset variables + auto-fill from context
  const handleTemplateChange = (templateId: string) => {
    const template = templatesData?.templates.find((t) => t.id === templateId);
    setSelectedTemplateId(templateId);
    setVariables(template ? buildAutoFill(template) : {});
    setPreview(null);
  };

  const handleVariableChange = (name: string, value: string) => {
    setVariables((prev) => ({ ...prev, [name]: value }));
    setPreview(null); // Invalidate preview when variables change
  };

  const handlePreview = async () => {
    if (!selectedTemplateId) return;
    const result = await previewMutation.mutateAsync({
      template_id: selectedTemplateId,
      variables,
    });
    setPreview(result);
  };

  const handleSend = async () => {
    if (!selectedTemplateId || recipientUserIds.length === 0) return;
    await sendMutation.mutateAsync({
      template_id: selectedTemplateId,
      recipient_user_ids: recipientUserIds,
      variables,
      client_id: context.client_id,
      program_id: context.program_id,
    });
    // Reset form after send
    setSelectedTemplateId("");
    setVariables({});
    setPreview(null);
    onSent?.();
  };

  const requiredVarNames = selectedTemplate?.variable_definitions
    ? Object.keys(selectedTemplate.variable_definitions)
    : [];

  const allRequiredFilled = requiredVarNames.every((name) => {
    const def = selectedTemplate?.variable_definitions?.[name];
    if (!def?.required) return true;
    return (variables[name] ?? "").trim().length > 0;
  });

  if (isLoadingTemplates) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading templates…
      </div>
    );
  }

  const templates = templatesData?.templates ?? [];

  return (
    <div className="space-y-4">
      {/* Template selector */}
      <div className="space-y-1.5">
        <Label htmlFor="template-select">Template</Label>
        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
          <SelectTrigger id="template-select">
            <SelectValue placeholder="Choose a template…" />
          </SelectTrigger>
          <SelectContent>
            {templates.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No templates available</div>
            ) : (
              templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t.template_type}</span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Variable fields — shown only when a template with variables is selected */}
      {selectedTemplate && requiredVarNames.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Template Variables
          </p>
          {requiredVarNames.map((name) => {
            const def = selectedTemplate.variable_definitions?.[name];
            const isRequired = def?.required ?? false;
            return (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={`var-${name}`}>
                  {name.replace(/_/g, " ")}
                  {isRequired && <span className="ml-0.5 text-destructive">*</span>}
                </Label>
                {def?.description && (
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                )}
                <Input
                  id={`var-${name}`}
                  value={variables[name] ?? ""}
                  onChange={(e) => handleVariableChange(name, e.target.value)}
                  placeholder={def?.default ?? `Enter ${name.replace(/_/g, " ")}…`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Preview panel */}
      {preview && (
        <>
          <Separator />
          <Card className="bg-muted/40">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Preview</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {preview.subject && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Subject: </span>
                  <span className="text-sm">{preview.subject}</span>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Body:</span>
                <pre className="text-sm whitespace-pre-wrap font-sans">{preview.body}</pre>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Action buttons */}
      {selectedTemplate && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!allRequiredFilled || previewMutation.isPending}
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : preview ? (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            ) : (
              <Eye className="mr-2 h-3.5 w-3.5" />
            )}
            {preview ? "Refresh Preview" : "Preview"}
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={
              !allRequiredFilled ||
              recipientUserIds.length === 0 ||
              sendMutation.isPending
            }
          >
            {sendMutation.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-2 h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      )}
    </div>
  );
}

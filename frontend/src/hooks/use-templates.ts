
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  previewTemplate,
  renderTemplate,
  sendFromTemplate,
  updateTemplate,
  updateTemplateStatus,
} from "@/lib/api/templates";
import type {
  CommunicationTemplate,
  SendFromTemplateRequest,
  TemplateCreateData,
  TemplatePreviewRequest,
  TemplateRenderRequest,
  TemplateStatusActionData,
} from "@/types/communication";

export function useTemplates(templateType?: string) {
  return useQuery({
    queryKey: ["templates", templateType],
    queryFn: () => listTemplates(templateType ? { template_type: templateType } : undefined),
    staleTime: 5 * 60 * 1000, // Templates change rarely; cache for 5 minutes
  });
}

/** Fetches ALL templates including inactive ones — for the management page. */
export function useAllTemplates(params?: { template_type?: string }) {
  return useQuery({
    queryKey: ["templates-all", params?.template_type],
    queryFn: () =>
      listTemplates({
        include_inactive: true,
        template_type: params?.template_type,
        limit: 100,
      }),
    staleTime: 60 * 1000,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TemplateCreateData) => createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["templates-all"] });
      toast.success("Template created");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create template"),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TemplateCreateData> & { is_active?: boolean } }) =>
      updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["templates-all"] });
      toast.success("Template updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update template"),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["templates-all"] });
      toast.success("Template deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete template"),
  });
}

export function useRenderTemplate() {
  return useMutation({
    mutationFn: (data: TemplateRenderRequest) => renderTemplate(data),
    onError: (error: Error) => toast.error(error.message || "Failed to render template"),
  });
}

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: (data: TemplatePreviewRequest) => previewTemplate(data),
  });
}

export function useSendFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SendFromTemplateRequest) => sendFromTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Message sent successfully");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send message"),
  });
}

export function useUpdateTemplateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TemplateStatusActionData }) =>
      updateTemplateStatus(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["templates-all"] });
      const labels: Record<string, string> = {
        submit: "Template submitted for approval",
        approve: "Template approved",
        reject: "Template rejected",
      };
      toast.success(labels[variables.data.action] ?? "Template status updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update template status"),
  });
}

// Re-export the CommunicationTemplate type for convenience in management pages
export type { CommunicationTemplate };

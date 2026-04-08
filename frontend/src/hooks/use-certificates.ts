
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCertificates,
  getCertificate,
  createCertificate,
  updateCertificate,
  issueCertificate,
  revokeCertificate,
  deleteCertificate,
  previewCertificate,
} from "@/lib/api/clearance-certificates";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  CertificateTemplateType,
  CertificateStatus,
  CertificateTemplateCreate,
  CertificateTemplateUpdate,
  ClearanceCertificateCreate,
  ClearanceCertificateUpdate,
  ClearanceCertificateIssue,
  ClearanceCertificateRevoke,
  ClearanceCertificateListParams,
  CertificatePreviewRequest,
} from "@/lib/api/clearance-certificates";

export function useCertificateTemplates(params?: {
  template_type?: CertificateTemplateType;
  is_active?: boolean;
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.certificates.templates.list(params),
    queryFn: () => listTemplates(params),
  });
}

export function useCertificateTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.certificates.templates.detail(id),
    queryFn: () => getTemplate(id),
    enabled: !!id,
  });
}

export function useCertificates(params?: ClearanceCertificateListParams) {
  return useQuery({
    queryKey: queryKeys.certificates.list(params),
    queryFn: () => listCertificates(params),
  });
}

export function useCertificate(id: string) {
  return useQuery({
    queryKey: queryKeys.certificates.detail(id),
    queryFn: () => getCertificate(id),
    enabled: !!id,
  });
}

export function useCreateCertificateTemplate() {
  return useCrudMutation({
    mutationFn: (data: CertificateTemplateCreate) => createTemplate(data),
    invalidateKeys: [queryKeys.certificates.templates.all],
    errorMessage: "Failed to create certificate template",
  });
}

export function useUpdateCertificateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: CertificateTemplateUpdate;
    }) => updateTemplate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templates.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.certificates.templates.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update certificate template"),
  });
}

export function useDeleteCertificateTemplate() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    invalidateKeys: [queryKeys.certificates.templates.all],
    errorMessage: "Failed to delete certificate template",
  });
}

export function useCreateCertificate() {
  return useCrudMutation({
    mutationFn: (data: ClearanceCertificateCreate) => createCertificate(data),
    invalidateKeys: [queryKeys.certificates.all],
    errorMessage: "Failed to create certificate",
  });
}

export function useUpdateCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ClearanceCertificateUpdate;
    }) => updateCertificate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.certificates.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update certificate"),
  });
}

export function useIssueCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ClearanceCertificateIssue;
    }) => issueCertificate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.certificates.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to issue certificate"),
  });
}

export function useRevokeCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ClearanceCertificateRevoke;
    }) => revokeCertificate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.certificates.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to revoke certificate"),
  });
}

export function useDeleteCertificate() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteCertificate(id),
    invalidateKeys: [queryKeys.certificates.all],
    errorMessage: "Failed to delete certificate",
  });
}

export function usePreviewCertificate() {
  return useMutation({
    mutationFn: (data: CertificatePreviewRequest) => previewCertificate(data),
    onError: (error: Error) =>
      toast.error(error.message || "Failed to preview certificate"),
  });
}

export type { CertificateStatus };

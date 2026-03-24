
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
    queryKey: ["certificates", "templates", params],
    queryFn: () => listTemplates(params),
  });
}

export function useCertificateTemplate(id: string) {
  return useQuery({
    queryKey: ["certificates", "templates", id],
    queryFn: () => getTemplate(id),
    enabled: !!id,
  });
}

export function useCertificates(params?: ClearanceCertificateListParams) {
  return useQuery({
    queryKey: ["certificates", params],
    queryFn: () => listCertificates(params),
  });
}

export function useCertificate(id: string) {
  return useQuery({
    queryKey: ["certificates", id],
    queryFn: () => getCertificate(id),
    enabled: !!id,
  });
}

export function useCreateCertificateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CertificateTemplateCreate) => createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates", "templates"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create certificate template"),
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
      queryClient.invalidateQueries({ queryKey: ["certificates", "templates"] });
      queryClient.invalidateQueries({
        queryKey: ["certificates", "templates", variables.id],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update certificate template"),
  });
}

export function useDeleteCertificateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates", "templates"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete certificate template"),
  });
}

export function useCreateCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClearanceCertificateCreate) => createCertificate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create certificate"),
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
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      queryClient.invalidateQueries({
        queryKey: ["certificates", variables.id],
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
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      queryClient.invalidateQueries({
        queryKey: ["certificates", variables.id],
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
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      queryClient.invalidateQueries({
        queryKey: ["certificates", variables.id],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to revoke certificate"),
  });
}

export function useDeleteCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCertificate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete certificate"),
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

import api from "@/lib/api";
import type {
  ComplianceReport,
  ComplianceReportListResponse,
  ComplianceReportListParams,
  ComplianceReportGenerateRequest,
} from "@/types/compliance-report";

export async function listComplianceReports(
  params?: ComplianceReportListParams,
): Promise<ComplianceReportListResponse> {
  const response = await api.get<ComplianceReportListResponse>(
    "/api/v1/kyc/compliance-reports",
    { params },
  );
  return response.data;
}

export async function getComplianceReport(
  id: string,
): Promise<ComplianceReport> {
  const response = await api.get<ComplianceReport>(
    `/api/v1/kyc/compliance-reports/${id}`,
  );
  return response.data;
}

export async function generateComplianceReport(
  data: ComplianceReportGenerateRequest,
): Promise<ComplianceReport> {
  const response = await api.post<ComplianceReport>(
    "/api/v1/kyc/compliance-reports",
    data,
  );
  return response.data;
}

export async function downloadComplianceReport(id: string): Promise<void> {
  const response = await api.get(
    `/api/v1/kyc/compliance-reports/${id}/download`,
    { responseType: "blob" },
  );
  const contentDisposition = response.headers["content-disposition"];
  let filename = `compliance_report_${new Date().toISOString().split("T")[0]}.pdf`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

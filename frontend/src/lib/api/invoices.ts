import api from "@/lib/api";
import type {
  Invoice,
  InvoiceListResponse,
  InvoiceListParams,
} from "@/types/invoice";

export async function listInvoices(
  params?: InvoiceListParams
): Promise<InvoiceListResponse> {
  const response = await api.get<InvoiceListResponse>("/api/v1/invoices/", {
    params,
  });
  return response.data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const response = await api.get<Invoice>(`/api/v1/invoices/${id}`);
  return response.data;
}

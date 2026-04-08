import type {
  Invoice,
  InvoiceListResponse,
  InvoiceListParams,
} from "@/types/invoice";
import { createApiClient } from "./factory";

const invoicesApi = createApiClient<Invoice, InvoiceListResponse>(
  "/api/v1/invoices/"
);

export const listInvoices = invoicesApi.list as (
  params?: InvoiceListParams,
) => Promise<InvoiceListResponse>;
export const getInvoice = invoicesApi.get;

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  client_id: string;
  program_id: string | null;
  amount: string;
  status: InvoiceStatus;
  due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
}

export interface InvoiceListParams {
  skip?: number;
  limit?: number;
  client_id?: string;
  program_id?: string;
  status?: string;
}

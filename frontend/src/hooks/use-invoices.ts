
import { useQuery } from "@tanstack/react-query";
import { listInvoices } from "@/lib/api/invoices";
import type { InvoiceListParams } from "@/types/invoice";

export function useInvoices(params?: InvoiceListParams) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => listInvoices(params),
  });
}

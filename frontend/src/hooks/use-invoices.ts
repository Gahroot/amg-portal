
import { useQuery } from "@tanstack/react-query";
import { listInvoices } from "@/lib/api/invoices";
import { queryKeys } from "@/lib/query-keys";
import type { InvoiceListParams } from "@/types/invoice";

export function useInvoices(params?: InvoiceListParams) {
  return useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => listInvoices(params),
  });
}

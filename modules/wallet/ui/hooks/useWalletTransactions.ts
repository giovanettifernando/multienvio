import { useQuery } from "@tanstack/react-query";
import type { StatementResponse } from '@/shared/types/wallet-statement';
import { apiFetch } from "@/platform/api/client";

export interface WalletTransactionsFilters {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useWalletTransactions(filters: WalletTransactionsFilters = {}) {
  const { dateFrom, dateTo, search, page = 1, limit = 20 } = filters;

  const params = new URLSearchParams();
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (search) params.set('search', search);
  params.set('page', page.toString());
  params.set('limit', limit.toString());

  return useQuery<StatementResponse>({
    queryKey: ["wallet", "transactions", dateFrom, dateTo, search, page, limit],
    queryFn: () => apiFetch<StatementResponse>(`/api/wallet/transactions?${params.toString()}`),
    retry: 1,
    staleTime: 30000, // 30 segundos
  });
}

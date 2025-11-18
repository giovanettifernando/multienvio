import { useQuery } from "@tanstack/react-query";
import type { StatementResponse } from "@/types/wallet-statement";

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
    queryFn: async () => {
      const response = await fetch(`/api/wallet/transactions?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('[useWalletTransactions] Error:', response.status, error);
        throw new Error(error.message || "Falha ao carregar transações");
      }
      const data = await response.json();
      console.log('[useWalletTransactions] Loaded transactions:', data.transactions?.length || 0);
      return data;
    },
    retry: 1,
    staleTime: 30000, // 30 segundos
  });
}

import { useQuery } from "@tanstack/react-query";
import type { WalletTransactionsResponse } from "@/types/wallet";

export function useWalletTransactions(limit = 20) {
  return useQuery<WalletTransactionsResponse>({
    queryKey: ["wallet", "transactions", limit],
    queryFn: async () => {
      const response = await fetch(`/api/wallet/transactions?limit=${limit}`);
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

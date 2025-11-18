import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WalletBalanceResponse } from "@/types/wallet-statement";

export function useWallet() {
  return useQuery<WalletBalanceResponse>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const response = await fetch("/api/wallet");
      if (!response.ok) {
        throw new Error("Falha ao carregar carteira");
      }
      return response.json();
    },
  });
}

export function useWalletInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["wallet"] });
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WalletBalanceResponse } from "@/types/wallet-statement";
import { apiFetch } from "@/lib/api/client";

export function useWallet() {
  return useQuery<WalletBalanceResponse>({
    queryKey: ["wallet"],
    queryFn: () => apiFetch<WalletBalanceResponse>("/api/wallet"),
  });
}

export function useWalletInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["wallet"] });
}

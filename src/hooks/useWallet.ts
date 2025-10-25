import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Wallet } from "@/types/wallet";

export function useWallet() {
  return useQuery<Wallet>({
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

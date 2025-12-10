'use client';

import { useQuery } from '@tanstack/react-query';
import type { WalletStatusResponse } from '@/app/api/wallet/status/route';

async function fetchWalletStatus(): Promise<WalletStatusResponse> {
  const res = await fetch('/api/wallet/status');
  if (!res.ok) {
    throw new Error('Erro ao buscar status da carteira');
  }
  const json = await res.json();
  // Handle standardized API response format { data: T, error, meta }
  return (json.data ?? json) as WalletStatusResponse;
}

/**
 * Hook para verificar o status da carteira do usuário
 *
 * Retorna:
 * - Saldo disponível
 * - Se há saldo negativo
 * - Se funcionalidades estão bloqueadas
 * - Valor da pendência
 */
export function useWalletStatus() {
  return useQuery({
    queryKey: ['wallet', 'status'],
    queryFn: fetchWalletStatus,
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook simplificado para verificar se o usuário pode cotar envios
 *
 * Retorna true se o usuário NÃO está bloqueado (pode cotar)
 * Retorna false se está bloqueado por saldo negativo
 */
export function useCanQuote() {
  const { data, isLoading } = useWalletStatus();

  return {
    canQuote: !data?.isBlocked,
    isLoading,
    blockReason: data?.blockReason,
    negativeAmountReais: data?.negativeAmountReais ?? 0,
  };
}

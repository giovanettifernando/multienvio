import { useQuery } from '@tanstack/react-query';

export type PickupFeeResult = {
  success: true;
  collector: {
    id: string;
    nome: string;
    pfNome: string;
    pjRazaoSocial: string;
  };
  distanceKm: number;
  feeType: 'FIXED' | 'PER_KM';
  feeAmount: number;
  totalWithPickup: number;
} | {
  success: false;
  error: string;
};

/**
 * Hook para calcular taxa de coleta na origem
 *
 * @param originCep - CEP de origem (remetente)
 * @param freightCost - Custo do frete em reais
 * @param enabled - Se a query deve ser executada
 */
export function usePickupFee(
  originCep: string | null | undefined,
  freightCost: number | null | undefined,
  enabled = true
) {
  const isEnabled = enabled && !!originCep && !!freightCost;

  console.log('[usePickupFee] Hook called:', JSON.stringify({
    originCep,
    freightCost,
    enabled,
    isEnabled,
  }, null, 2));

  return useQuery({
    queryKey: ['pickupFee', originCep, freightCost],
    queryFn: async (): Promise<PickupFeeResult | null> => {
      console.log('[usePickupFee] Executing query...', JSON.stringify({ originCep, freightCost }, null, 2));

      if (!originCep || !freightCost) {
        console.log('[usePickupFee] Missing params, returning null');
        return null;
      }

      const cleanCep = originCep.replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        console.log('[usePickupFee] Invalid CEP length, returning null');
        return null;
      }

      console.log('[usePickupFee] Fetching from API...', JSON.stringify({ cleanCep, freightCost }, null, 2));

      const response = await fetch('/api/pickup-fee/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originCep: cleanCep, freightCost }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[usePickupFee] API error:', error);
        return { success: false, error: error.error || 'Erro ao calcular taxa de coleta' };
      }

      const data: PickupFeeResult = await response.json();
      console.log('[usePickupFee] Success:', JSON.stringify(data, null, 2));
      return data;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutos (coleta não muda frequentemente)
    gcTime: 15 * 60 * 1000, // 15 minutos
    retry: 1,
  });
}

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
  return useQuery({
    queryKey: ['pickupFee', originCep, freightCost],
    queryFn: async (): Promise<PickupFeeResult | null> => {
      if (!originCep || !freightCost) return null;

      const cleanCep = originCep.replace(/\D/g, '');
      if (cleanCep.length !== 8) return null;

      const response = await fetch('/api/pickup-fee/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originCep: cleanCep, freightCost }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Erro ao calcular taxa de coleta' };
      }

      const data: PickupFeeResult = await response.json();
      return data;
    },
    enabled: enabled && !!originCep && !!freightCost,
    staleTime: 5 * 60 * 1000, // 5 minutos (coleta não muda frequentemente)
    gcTime: 15 * 60 * 1000, // 15 minutos
    retry: 1,
  });
}

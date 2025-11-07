import { useQuery } from '@tanstack/react-query';

export interface PickupPoint {
  id: string;
  name: string;
  alias: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  uf: string;
  cep: string;
  lat: number | null;
  lng: number | null;
}

interface UsePickupPointsParams {
  cidade?: string | null;
  uf?: string | null;
  q?: string;
  enabled?: boolean;
}

export function usePickupPoints({ cidade, uf, q, enabled = true }: UsePickupPointsParams = {}) {
  return useQuery({
    queryKey: ['pickupPoints', cidade, uf, q],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (cidade) params.set('cidade', cidade);
      if (uf) params.set('uf', uf);
      if (q) params.set('q', q);

      const response = await fetch(`/api/pickup-points?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar pontos de coleta');
      }

      const data: PickupPoint[] = await response.json();
      return data;
    },
    enabled: enabled && !!(cidade || uf || q),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

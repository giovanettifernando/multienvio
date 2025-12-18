import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/platform/api/client';

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
    queryFn: () => {
      const params = new URLSearchParams();

      if (cidade) params.set('cidade', cidade);
      if (uf) params.set('uf', uf);
      if (q) params.set('q', q);

      return apiFetch<PickupPoint[]>(`/api/pickup-points?${params.toString()}`);
    },
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

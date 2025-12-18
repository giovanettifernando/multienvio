import { useQuery } from '@tanstack/react-query';
import type { GeoCoordinates } from '@/shared/utils/geo';

interface GeocodeResponse {
  cep: string;
  coordinates: GeoCoordinates;
}

export function useGeocode(cep: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['geocode', cep],
    queryFn: async (): Promise<GeocodeResponse | null> => {
      if (!cep) return null;

      const cleanCep = cep.replace(/\D/g, '');
      if (cleanCep.length !== 8) return null;

      const response = await fetch(`/api/geocode?cep=${cleanCep}`);

      if (!response.ok) {
        // Se falhar, retornar null em vez de lançar erro
        // Isso permite usar fallback de coordenadas da UF
        return null;
      }

      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      const data: GeocodeResponse = json.data ?? json;
      return data;
    },
    enabled: enabled && !!cep,
    staleTime: 24 * 60 * 60 * 1000, // 24 horas (CEPs não mudam)
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 dias
    retry: 1, // Tentar apenas 1 vez
  });
}

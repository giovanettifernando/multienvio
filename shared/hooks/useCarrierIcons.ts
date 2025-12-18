import { useQuery } from '@tanstack/react-query';

type CarrierIconsMap = Record<string, string>;

async function fetchCarrierIcons(): Promise<CarrierIconsMap> {
  const res = await fetch('/api/public/carrier-icons');
  if (!res.ok) {
    throw new Error('Erro ao carregar ícones das transportadoras');
  }
  const json = await res.json();
  return json.data ?? {};
}

/**
 * Hook para obter os ícones das transportadoras.
 * Retorna um mapa de slug -> URL do ícone.
 *
 * @example
 * const { carrierIcons } = useCarrierIcons();
 * const correiosIcon = carrierIcons['correios'];
 */
export function useCarrierIcons() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['carrier-icons'],
    queryFn: fetchCarrierIcons,
    staleTime: 1000 * 60 * 30, // 30 minutos
    gcTime: 1000 * 60 * 60, // 1 hora
  });

  return {
    carrierIcons: data ?? {},
    isLoading,
    error,
  };
}

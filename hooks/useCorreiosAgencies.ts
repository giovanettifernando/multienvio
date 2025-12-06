/**
 * Hook para buscar agências dos Correios próximas
 */

import { useQuery } from '@tanstack/react-query';

export interface CorreiosAgency {
  id: string;
  nome: string;
  tipoUnidadeSigla: string;
  tipoUnidadeDescricao: string | null;
  cep: string;
  uf: string;
  municipio: string;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  latitude: number | null;
  longitude: number | null;
  horarioFuncionamento: string | null;
  iniExpediente: string | null;
  fimExpediente: string | null;
  enderecoCompleto: string;
}

interface UseCorreiosAgenciesParams {
  uf: string | undefined;
  municipio?: string;
  enabled?: boolean;
  limit?: number;
}

interface CorreiosAgenciesResponse {
  agencies: CorreiosAgency[];
  total: number;
  uf: string;
  municipio: string | null;
}

async function fetchCorreiosAgencies(
  uf: string,
  municipio?: string,
  limit?: number
): Promise<CorreiosAgenciesResponse> {
  const params = new URLSearchParams({ uf });
  if (municipio) {
    params.append('municipio', municipio);
  }
  if (limit) {
    params.append('limit', limit.toString());
  }

  const response = await fetch(`/api/correios-agencies/nearby?${params}`);
  if (!response.ok) {
    throw new Error('Erro ao buscar agências dos Correios');
  }
  return response.json();
}

/**
 * Hook para buscar agências dos Correios por UF/município
 */
export function useCorreiosAgencies({
  uf,
  municipio,
  enabled = true,
  limit = 10,
}: UseCorreiosAgenciesParams) {
  return useQuery({
    queryKey: ['correios-agencies-nearby', uf, municipio, limit],
    queryFn: () => fetchCorreiosAgencies(uf!, municipio, limit),
    enabled: enabled && !!uf,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });
}

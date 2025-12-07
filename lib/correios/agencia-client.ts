/**
 * Cliente para API de Agências dos Correios
 *
 * Busca informações de unidades/agências dos Correios para
 * exibição na finalização de cotações quando Correios é selecionado.
 *
 * Endpoint: GET /agencia/v1/unidades
 * Documentação: API 30 - CWS Correios
 */

import { correiosFetch, getCorreiosConfigAsync } from '@/lib/integrations/correios/client';
import type { CorreiosAgencyStatus, CorreiosAgencyType } from '@prisma/client';

// ============================================================================
// Tipos da API dos Correios
// ============================================================================

export interface CorreiosAgenciaAPI {
  id: string;
  nome: string;
  status: string; // "2" = Ativa, "5" = Inativa
  descStatus: string;
  tipoUnidade: {
    codigo: string;
    descricao: string;
    sigla: string; // Ex: "AC -TCO"
  };
  endereco: {
    cep: string;
    uf: string;
    municipio: string;
    localidade?: string;
    bairro?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    latitude?: string;
    longitude?: string;
  };
  horarios?: {
    funcionamento?: string;
    iniExpediente?: string;
    fimExpediente?: string;
  };
  // Campos legados (mantidos para compatibilidade)
  latitude?: number;
  longitude?: number;
  horarioFuncionamento?: string;
  iniExpediente?: string;
  fimExpediente?: string;
}

export interface CorreiosAgenciasResponse {
  itens: CorreiosAgenciaAPI[];
  pagina?: number;
  quantidade?: number;
  totalRegistros?: number;
  totalPaginas?: number;
}

export interface ListarAgenciasParams {
  uf?: string;
  municipio?: string;
  status?: number; // 2 = Ativa, 5 = Inativa
  tipoUnidade?: string; // "09", "12", etc
  page?: number;   // Número da página (0-indexed)
  size?: number;   // Quantidade por página (máx 50)
}

// ============================================================================
// Mapeamento de tipos
// ============================================================================

export function mapStatusToEnum(status: string | number): CorreiosAgencyStatus {
  const statusStr = String(status);
  switch (statusStr) {
    case '2':
      return 'ATIVA';
    case '5':
      return 'INATIVA';
    default:
      return 'OUTRO';
  }
}

export function mapTipoSiglaToEnum(sigla: string): CorreiosAgencyType {
  // A sigla vem no formato "AC -TCO", precisamos extrair apenas a parte inicial
  const cleanSigla = sigla.split(' ')[0].trim();

  const mapped: Record<string, CorreiosAgencyType> = {
    'AC': 'AC',
    'ACF': 'ACF',
    'AGF': 'AGF',
    'CDD': 'CDD',
    'CTE': 'CTE',
    'CTCE': 'CTCE',
    'CEE': 'CEE',
    'CTCI': 'CTCI',
  };
  return mapped[cleanSigla] || 'OUTROS';
}

// ============================================================================
// Cliente
// ============================================================================

/**
 * Lista agências dos Correios via API
 *
 * @param params Parâmetros de filtro e paginação
 * @returns Lista de agências
 */
export async function listarAgencias(
  params: ListarAgenciasParams = {}
): Promise<CorreiosAgenciasResponse> {
  const queryParams = new URLSearchParams();

  if (params.uf) {
    queryParams.append('uf', params.uf);
  }
  if (params.municipio) {
    queryParams.append('municipio', params.municipio);
  }
  if (params.status !== undefined) {
    queryParams.append('status', params.status.toString());
  }
  if (params.tipoUnidade) {
    queryParams.append('tipoUnidade', params.tipoUnidade);
  }
  // Parâmetros de paginação: page (número da página) e size (itens por página)
  if (params.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  if (params.size !== undefined) {
    queryParams.append('size', params.size.toString());
  }

  const queryString = queryParams.toString();
  const path = `/agencia/v1/unidades${queryString ? `?${queryString}` : ''}`;

  console.log('[AGENCIA_CLIENT] Buscando agências:', { path, params });

  const response = await correiosFetch<CorreiosAgenciasResponse>(path, {
    method: 'GET',
  });

  console.log('[AGENCIA_CLIENT] Resposta:', {
    pagina: response.pagina,
    quantidade: response.quantidade,
    totalRegistros: response.totalRegistros,
    totalPaginas: response.totalPaginas,
  });

  return response;
}

/**
 * Busca todas as agências paginando automaticamente
 *
 * @param params Parâmetros de filtro (sem paginação)
 * @param maxPages Máximo de páginas a buscar (segurança)
 * @returns Lista completa de agências
 */
export async function listarTodasAgencias(
  params: Omit<ListarAgenciasParams, 'page' | 'size'> = {},
  maxPages = 200
): Promise<CorreiosAgenciaAPI[]> {
  const allItems: CorreiosAgenciaAPI[] = [];
  let page = 0;
  // A API dos Correios retorna no máximo 50 itens por página
  const size = 50;

  console.log('[AGENCIA_CLIENT] Iniciando busca completa de agências:', params);

  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 3;

  while (page < maxPages) {
    try {
      const response = await listarAgencias({
        ...params,
        page,
        size,
      });

      // Reset error counter on success
      consecutiveErrors = 0;

      // Se não há itens, parar
      if (!response.itens || response.itens.length === 0) {
        break;
      }

      allItems.push(...response.itens);

      console.log('[AGENCIA_CLIENT] Progresso:', {
        page,
        itensNaPagina: response.itens.length,
        totalAcumulado: allItems.length,
        totalRegistros: response.totalRegistros ?? 'N/A',
      });

      // Continuar se a página veio cheia (pode haver mais)
      // A API dos Correios retorna exatamente 50 por página quando há mais
      if (response.itens.length < size) {
        // Página incompleta = última página
        break;
      }

      page++;
    } catch (error) {
      consecutiveErrors++;
      console.error(`[AGENCIA_CLIENT] Erro na página ${page}:`, error instanceof Error ? error.message : error);

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.warn(`[AGENCIA_CLIENT] ${maxConsecutiveErrors} erros consecutivos, parando. Total coletado: ${allItems.length}`);
        break;
      }

      // Tentar próxima página mesmo com erro
      page++;
    }
  }

  console.log('[AGENCIA_CLIENT] Busca completa finalizada:', {
    totalAgencias: allItems.length,
    paginasBuscadas: page + 1,
  });

  return allItems;
}

/**
 * Busca agências por UF
 */
export async function listarAgenciasPorUF(uf: string): Promise<CorreiosAgenciaAPI[]> {
  return listarTodasAgencias({ uf, status: 2 }); // Apenas ativas
}

/**
 * Busca agências por município
 */
export async function listarAgenciasPorMunicipio(
  uf: string,
  municipio: string
): Promise<CorreiosAgenciaAPI[]> {
  return listarTodasAgencias({ uf, municipio, status: 2 }); // Apenas ativas
}

/**
 * Verifica se a API de agências está acessível
 */
export async function testarConexaoAgencias(): Promise<{
  success: boolean;
  message: string;
  latencyMs: number;
}> {
  const startTime = Date.now();

  try {
    // Buscar apenas 1 agência para testar
    const response = await listarAgencias({
      size: 1,
      status: 2,
    });

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      message: `Conexão OK. Total de agências: ${response.totalRegistros}`,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      latencyMs,
    };
  }
}

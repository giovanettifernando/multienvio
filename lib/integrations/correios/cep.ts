/**
 * Serviço de Consulta de CEP - API Oficial dos Correios
 *
 * Endpoint: GET /cep/v1/enderecos/{cep}
 * Documentação: https://www.correios.com.br/atendimento/developers
 *
 * Exemplo de resposta:
 * {
 *   "cep": "01310100",
 *   "uf": "SP",
 *   "localidade": "São Paulo",
 *   "bairro": "Bela Vista",
 *   "logradouro": "Avenida Paulista",
 *   "complemento": "- lado par",
 *   "tipoLogradouro": "Avenida",
 *   "numeroFaixa": {
 *     "inicio": "0",
 *     "fim": "0"
 *   }
 * }
 */

import { correiosFetch, getCorreiosConfigAsync, validateCorreiosConfig } from './client';
import { CORREIOS_ENDPOINTS } from './constants';

/**
 * Resposta da API de CEP dos Correios
 */
export interface CorreiosCepResponse {
  cep: string;
  uf: string;
  localidade: string;
  bairro: string;
  logradouro: string;
  complemento?: string;
  tipoLogradouro?: string;
  numeroFaixa?: {
    inicio: string;
    fim: string;
  };
}

/**
 * Resultado normalizado da consulta de CEP
 */
export interface CepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  source: 'correios' | 'brasilapi' | 'viacep';
}

/**
 * Erro de consulta de CEP
 */
export class CepError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'INVALID' | 'SERVICE_UNAVAILABLE' | 'AUTH_ERROR',
    public readonly source?: string
  ) {
    super(message);
    this.name = 'CepError';
  }
}

/**
 * Normaliza CEP removendo caracteres não numéricos
 */
export function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Valida se o CEP tem 8 dígitos
 */
export function isValidCep(cep: string): boolean {
  const normalized = normalizeCep(cep);
  return normalized.length === 8;
}

/**
 * Formata CEP para exibição (99999-999)
 */
export function formatCep(cep: string): string {
  const normalized = normalizeCep(cep);
  if (normalized.length !== 8) return normalized;
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

/**
 * Consulta CEP via API oficial dos Correios
 *
 * @param cep - CEP com ou sem formatação
 * @returns Dados do endereço normalizado
 * @throws CepError em caso de falha
 */
export async function consultarCepCorreios(cep: string): Promise<CepResult> {
  const normalized = normalizeCep(cep);

  if (!isValidCep(normalized)) {
    throw new CepError('CEP deve ter 8 dígitos', 'INVALID', 'correios');
  }

  // Verificar se Correios está configurado (busca do banco de dados)
  const config = await getCorreiosConfigAsync();
  const validation = validateCorreiosConfig(config);
  if (!validation.valid) {
    console.warn('[consultarCepCorreios] Correios não configurado:', validation.errors);
    throw new CepError('Correios não configurado', 'AUTH_ERROR', 'correios');
  }

  try {
    const endpoint = `${CORREIOS_ENDPOINTS.cep}/${normalized}`;
    const data = await correiosFetch<CorreiosCepResponse>(endpoint, {
      method: 'GET',
      timeout: 10000, // 10 segundos
    });

    // Normalizar resposta
    return {
      cep: formatCep(data.cep),
      logradouro: data.logradouro || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.localidade,
      uf: data.uf,
      source: 'correios',
    };
  } catch (error) {
    // Tratar erros específicos da API dos Correios
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('404') || message.includes('não encontrado')) {
        throw new CepError('CEP não encontrado', 'NOT_FOUND', 'correios');
      }

      if (message.includes('401') || message.includes('auth') || message.includes('token')) {
        throw new CepError('Erro de autenticação com Correios', 'AUTH_ERROR', 'correios');
      }
    }

    throw new CepError(
      'Serviço de CEP dos Correios indisponível',
      'SERVICE_UNAVAILABLE',
      'correios'
    );
  }
}

/**
 * Consulta CEP via BrasilAPI (fallback)
 *
 * @param cep - CEP com ou sem formatação
 * @returns Dados do endereço normalizado ou null se não encontrado
 */
export async function consultarCepBrasilApi(cep: string): Promise<CepResult | null> {
  const normalized = normalizeCep(cep);

  if (!isValidCep(normalized)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://brasilapi.com.br/api/cep/v2/${normalized}`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      cep: formatCep(data.cep),
      logradouro: data.street || '',
      complemento: '',
      bairro: data.neighborhood || '',
      cidade: data.city,
      uf: data.state,
      source: 'brasilapi',
    };
  } catch {
    console.warn('[consultarCepBrasilApi] Falha na consulta');
    return null;
  }
}

/**
 * Consulta CEP com fallback automático
 *
 * Ordem de prioridade:
 * 1. API oficial dos Correios (primária)
 * 2. BrasilAPI (fallback)
 *
 * @param cep - CEP com ou sem formatação
 * @returns Dados do endereço normalizado
 * @throws CepError se nenhum serviço retornar resultado
 */
export async function consultarCep(cep: string): Promise<CepResult> {
  const normalized = normalizeCep(cep);

  if (!isValidCep(normalized)) {
    throw new CepError('CEP deve ter 8 dígitos', 'INVALID');
  }

  // Tentar API dos Correios primeiro
  try {
    const result = await consultarCepCorreios(normalized);
    console.log(`[consultarCep] Sucesso via Correios: ${normalized}`);
    return result;
  } catch (error) {
    // Log do erro para diagnóstico
    if (error instanceof CepError) {
      console.warn(`[consultarCep] Correios falhou (${error.code}): ${error.message}`);

      // Se CEP não foi encontrado nos Correios, não tentar fallback
      // (a base dos Correios é autoritativa)
      if (error.code === 'NOT_FOUND') {
        throw error;
      }
    } else {
      console.warn('[consultarCep] Correios falhou com erro inesperado:', error);
    }
  }

  // Fallback para BrasilAPI
  console.log(`[consultarCep] Tentando BrasilAPI como fallback: ${normalized}`);
  const brasilApiResult = await consultarCepBrasilApi(normalized);

  if (brasilApiResult) {
    console.log(`[consultarCep] Sucesso via BrasilAPI: ${normalized}`);
    return brasilApiResult;
  }

  // Nenhum serviço retornou resultado
  throw new CepError(
    'CEP não encontrado ou serviços indisponíveis',
    'SERVICE_UNAVAILABLE'
  );
}

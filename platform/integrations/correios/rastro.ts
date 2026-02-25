/**
 * Módulo de Rastreamento (Rastro) dos Correios
 *
 * Responsabilidades:
 * - Consultar status de rastreamento de objetos
 * - Converter eventos dos Correios para formato interno
 *
 * Referência: API Rastro CWS (SRO - Sistema de Rastreamento de Objetos)
 * Endpoint: GET /srorastro/v1/objetos/{codigoObjeto}?resultado=T
 * Parâmetros:
 * - resultado: T = todos os eventos, U = último evento
 */

import { correiosFetch } from './client';
import {
  type CorreiosRastroResponse,
  type CorreiosRastroObjeto,
  type CorreiosRastroEvento,
  CorreiosApiError,
} from './types';
import { CORREIOS_ENDPOINTS, TRACKING_STATUS_MAP } from './constants';

// ============================================================================
// Tipos de Saída
// ============================================================================

export interface TrackingEvent {
  codigo: string;
  tipo: string;
  descricao: string;
  dataHora: Date;
  local?: string;
  cidade?: string;
  uf?: string;
  destinoLocal?: string;
  destinoCidade?: string;
  destinoUf?: string;
  statusInterno?: string;  // Status mapeado para o sistema interno
}

export interface TrackingResult {
  codigoObjeto: string;
  tipoPostal?: string;
  categoria?: string;
  eventos: TrackingEvent[];
  mensagem?: string;       // Mensagem de erro se houver
  ultimoStatus?: string;   // Último status conhecido
  entregue: boolean;       // Se o objeto foi entregue
  bruto: unknown;          // Resposta original
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Converte evento dos Correios para formato interno
 */
function parseEvento(evento: CorreiosRastroEvento): TrackingEvent {
  const result: TrackingEvent = {
    codigo: evento.codigo,
    tipo: evento.tipo,
    descricao: evento.descricao,
    dataHora: new Date(evento.dtHrCriado),
  };

  // Local do evento
  if (evento.unidade) {
    result.local = evento.unidade.tipo;
    if (evento.unidade.endereco) {
      result.cidade = evento.unidade.endereco.cidade;
      result.uf = evento.unidade.endereco.uf;
    }
  }

  // Destino (se houver)
  if (evento.unidadeDestino) {
    result.destinoLocal = evento.unidadeDestino.tipo;
    if (evento.unidadeDestino.endereco) {
      result.destinoCidade = evento.unidadeDestino.endereco.cidade;
      result.destinoUf = evento.unidadeDestino.endereco.uf;
    }
  }

  // Mapear para status interno
  result.statusInterno = TRACKING_STATUS_MAP[evento.codigo] || evento.descricao;

  return result;
}

/**
 * Verifica se o objeto foi entregue baseado nos eventos
 */
function isDelivered(eventos: TrackingEvent[]): boolean {
  // Códigos que indicam entrega
  const deliveryCodes = ['BDE', 'BDI'];

  return eventos.some((e) => deliveryCodes.includes(e.codigo));
}

/**
 * Processa resposta de objeto individual
 */
function parseObjeto(objeto: CorreiosRastroObjeto): TrackingResult {
  const eventos = (objeto.eventos || []).map(parseEvento);

  // Ordenar eventos por data (mais recente primeiro)
  eventos.sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());

  const result: TrackingResult = {
    codigoObjeto: objeto.codObjeto,
    tipoPostal: objeto.tipoPostal?.descricao,
    categoria: objeto.tipoPostal?.categoria,
    eventos,
    mensagem: objeto.mensagem,
    ultimoStatus: eventos.length > 0 ? eventos[0].statusInterno : undefined,
    entregue: isDelivered(eventos),
    bruto: objeto,
  };

  return result;
}

// ============================================================================
// API de Rastreamento
// ============================================================================

export type ResultadoRastro = 'T' | 'U';  // T = Todos eventos, U = Último evento

/**
 * Rastreia um objeto pelo código de rastreio (SRO)
 *
 * @param codigoObjeto Código de rastreio (ex: NX000000000BR)
 * @param resultado 'T' para todos os eventos, 'U' para último evento
 * @returns Resultado do rastreamento
 */
export async function rastrearObjeto(
  codigoObjeto: string,
  resultado: ResultadoRastro = 'T'
): Promise<TrackingResult> {
  const codigo = codigoObjeto.trim().toUpperCase();

  console.log('[CORREIOS_RASTRO] Tracking object:', { codigo, resultado });

  try {
    const response = await correiosFetch<CorreiosRastroResponse>(
      `${CORREIOS_ENDPOINTS.rastro}/${codigo}?resultado=${resultado}`,
      {
        method: 'GET',
        headers: {
          'Accept-Language': 'pt-BR',  // Obrigatório: pt-BR, en ou es-ES
        },
      }
    );

    if (!response.objetos || response.objetos.length === 0) {
      return {
        codigoObjeto: codigo,
        eventos: [],
        mensagem: 'Objeto não encontrado',
        entregue: false,
        bruto: response,
      };
    }

    const objeto = response.objetos[0];
    return parseObjeto(objeto);
  } catch (error) {
    console.error('[CORREIOS_RASTRO] Tracking failed:', error);

    // Retornar resultado com erro
    return {
      codigoObjeto: codigo,
      eventos: [],
      mensagem: error instanceof Error ? error.message : 'Erro ao rastrear objeto',
      entregue: false,
      bruto: null,
    };
  }
}

/**
 * Rastreia múltiplos objetos
 *
 * A API dos Correios suporta até 50 objetos por requisição,
 * mas recomendamos lotes menores para evitar timeouts.
 *
 * @param codigos Array de códigos de rastreio
 * @param resultado 'T' para todos os eventos, 'U' para último evento
 * @returns Array de resultados
 */
export async function rastrearObjetos(
  codigos: string[],
  resultado: ResultadoRastro = 'T'
): Promise<TrackingResult[]> {
  if (codigos.length === 0) {
    return [];
  }

  const codigosNormalizados = codigos.map((c) => c.trim().toUpperCase());

  console.log('[CORREIOS_RASTRO] Tracking multiple objects:', {
    quantidade: codigosNormalizados.length,
    resultado,
  });

  try {
    // Concatenar códigos com ponto-e-vírgula (formato da API)
    const codigosParam = codigosNormalizados.join(';');

    const response = await correiosFetch<CorreiosRastroResponse>(
      `${CORREIOS_ENDPOINTS.rastro}/${codigosParam}?resultado=${resultado}`,
      {
        method: 'GET',
        headers: {
          'Accept-Language': 'pt-BR',  // Obrigatório: pt-BR, en ou es-ES
        },
      }
    );

    if (!response.objetos || response.objetos.length === 0) {
      // Retornar resultado vazio para cada código
      return codigosNormalizados.map((codigo) => ({
        codigoObjeto: codigo,
        eventos: [],
        mensagem: 'Objeto não encontrado',
        entregue: false,
        bruto: null,
      }));
    }

    // Processar cada objeto
    return response.objetos.map(parseObjeto);
  } catch (error) {
    console.error('[CORREIOS_RASTRO] Batch tracking failed:', error);

    // Retornar erro para cada código
    return codigosNormalizados.map((codigo) => ({
      codigoObjeto: codigo,
      eventos: [],
      mensagem: error instanceof Error ? error.message : 'Erro ao rastrear',
      entregue: false,
      bruto: null,
    }));
  }
}

/**
 * Verifica se um código de rastreio é válido (formato)
 *
 * Formato SRO: 2 letras + 9 dígitos + 2 letras (país)
 * Ex: NX000000000BR
 */
export function isValidTrackingCode(codigo: string): boolean {
  const regex = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
  return regex.test(codigo.trim().toUpperCase());
}


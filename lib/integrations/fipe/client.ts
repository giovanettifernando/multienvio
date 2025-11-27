/**
 * Cliente para a FIPE API v2
 * Docs: https://deividfortuna.github.io/fipe/v2/
 *
 * Limites:
 * - Sem token: 500 req/dia
 * - Com token (gratuito via fipe.online): 1000 req/dia
 */

const FIPE_BASE_URL = process.env.FIPE_BASE_URL || 'https://fipe.parallelum.com.br/api/v2';
const FIPE_SUBSCRIPTION_TOKEN = process.env.FIPE_SUBSCRIPTION_TOKEN;

export type FipeVehicleType = 'cars' | 'motorcycles' | 'trucks';

export interface FipeReference {
  code: string;
  month: string;
}

export interface FipeBrand {
  code: string;
  name: string;
}

export interface FipeModel {
  code: string;
  name: string;
}

/**
 * Constrói os headers para requisições à FIPE API
 */
function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  if (FIPE_SUBSCRIPTION_TOKEN) {
    headers['X-Subscription-Token'] = FIPE_SUBSCRIPTION_TOKEN;
  }

  return headers;
}

/**
 * Executa requisição à FIPE API com tratamento de erros
 */
async function fipeFetch<T>(path: string): Promise<T> {
  const url = `${FIPE_BASE_URL}${path}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new FipeApiError(
      `FIPE API error: ${response.status} ${response.statusText}`,
      response.status,
      errorText
    );
  }

  return response.json();
}

/**
 * Erro customizado para API FIPE
 */
export class FipeApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = 'FipeApiError';
  }
}

/**
 * Busca todos os meses de referência disponíveis
 * O maior code é sempre a referência mais atual
 */
export async function getReferences(): Promise<FipeReference[]> {
  return fipeFetch<FipeReference[]>('/references');
}

/**
 * Busca a referência mais atual (maior code)
 */
export async function getCurrentReference(): Promise<FipeReference> {
  const references = await getReferences();

  if (!references.length) {
    throw new Error('Nenhuma referência FIPE encontrada');
  }

  // Encontra a referência com maior code (mais recente)
  return references.reduce((latest, current) => {
    const latestCode = parseInt(latest.code, 10);
    const currentCode = parseInt(current.code, 10);
    return currentCode > latestCode ? current : latest;
  });
}

/**
 * Busca todas as marcas de um tipo de veículo
 */
export async function getBrands(
  vehicleType: FipeVehicleType,
  referenceCode: number
): Promise<FipeBrand[]> {
  return fipeFetch<FipeBrand[]>(`/${vehicleType}/brands?reference=${referenceCode}`);
}

/**
 * Busca todos os modelos de uma marca
 */
export async function getModels(
  vehicleType: FipeVehicleType,
  brandCode: string,
  referenceCode: number
): Promise<FipeModel[]> {
  return fipeFetch<FipeModel[]>(
    `/${vehicleType}/brands/${brandCode}/models?reference=${referenceCode}`
  );
}

/**
 * Delay helper para respeitar rate limits
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

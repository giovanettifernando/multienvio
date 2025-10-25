/**
 * BrasilAPI CEP v2 integration
 * Consulta CEP diretamente no browser via fetch
 */

export type CepResponse = {
  cep: string;
  state: string;
  city: string;
  neighborhood?: string;
  street?: string;
  service?: string;
  location?: {
    type: string;
    coordinates: {
      longitude: string;
      latitude: string;
    };
  };
};

export type CepError = {
  type: 'not_found' | 'rate_limit' | 'timeout' | 'network' | 'invalid';
  message: string;
};

/**
 * Remove caracteres não numéricos do CEP
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
 * Busca informações de um CEP via BrasilAPI v2
 * @param cep - CEP com ou sem formatação
 * @param timeoutMs - Timeout em milissegundos (padrão: 5000ms)
 * @returns Promise com dados do CEP
 * @throws CepError com tipo e mensagem do erro
 */
export async function fetchCepV2(
  cep: string,
  timeoutMs: number = 5000
): Promise<CepResponse> {
  const normalized = normalizeCep(cep);

  if (!isValidCep(normalized)) {
    throw {
      type: 'invalid',
      message: 'CEP deve ter 8 dígitos',
    } as CepError;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cep/v2/${normalized}`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    clearTimeout(timeoutId);

    if (response.status === 404) {
      throw {
        type: 'not_found',
        message: 'CEP não encontrado',
      } as CepError;
    }

    if (response.status === 429) {
      throw {
        type: 'rate_limit',
        message: 'Muitas consultas — tente novamente em instantes',
      } as CepError;
    }

    if (!response.ok) {
      throw {
        type: 'network',
        message: 'Erro ao consultar CEP — tente novamente',
      } as CepError;
    }

    const data = await response.json();
    return data as CepResponse;
  } catch (error) {
    clearTimeout(timeoutId);

    // Erro de timeout (AbortError)
    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        type: 'timeout',
        message: 'Conexão instável — tente novamente',
      } as CepError;
    }

    // Re-throw erros customizados
    if (error && typeof error === 'object' && 'type' in error) {
      throw error;
    }

    // Erro de rede genérico
    throw {
      type: 'network',
      message: 'Erro ao consultar CEP — verifique sua conexão',
    } as CepError;
  }
}

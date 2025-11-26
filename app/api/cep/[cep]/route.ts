import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type CepRouteParams = Promise<{ cep: string }>;

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface BrasilApiResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

interface CepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/**
 * Fetch com retry e timeout
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  timeoutMs = 8000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Se não for o último attempt, aguardar antes de tentar novamente
      if (attempt < maxRetries) {
        const backoffMs = 500 * (attempt + 1);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}

/**
 * Consulta CEP via ViaCEP
 */
async function fetchViaCep(digits: string): Promise<CepResult | null> {
  try {
    const response = await fetchWithRetry(
      `https://viacep.com.br/ws/${digits}/json/`,
      {},
      2,
      8000
    );

    if (!response.ok) {
      return null;
    }

    const data: ViaCepResponse = await response.json();

    // ViaCEP retorna {erro: true} quando CEP não existe
    if (data.erro) {
      return null;
    }

    return {
      cep: data.cep,
      logradouro: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.localidade,
      uf: data.uf,
    };
  } catch (error) {
    console.warn('[fetchViaCep] Falha:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Consulta CEP via BrasilAPI (fallback)
 */
async function fetchBrasilApi(digits: string): Promise<CepResult | null> {
  try {
    const response = await fetchWithRetry(
      `https://brasilapi.com.br/api/cep/v2/${digits}`,
      {},
      2,
      8000
    );

    if (!response.ok) {
      return null;
    }

    const data: BrasilApiResponse = await response.json();

    return {
      cep: data.cep,
      logradouro: data.street || '',
      complemento: '',
      bairro: data.neighborhood || '',
      cidade: data.city,
      uf: data.state,
    };
  } catch (error) {
    console.warn('[fetchBrasilApi] Falha:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function GET(_request: NextRequest, context: { params: CepRouteParams }) {
  try {
    const { cep } = await context.params;

    // Remove qualquer formatação para validar apenas dígitos
    const digits = cep.replace(/\D/g, '');

    // Valida se tem 8 dígitos
    if (digits.length !== 8) {
      return NextResponse.json(
        { error: "CEP inválido. Deve conter 8 dígitos." },
        { status: 400 }
      );
    }

    // Tenta ViaCEP primeiro
    let result = await fetchViaCep(digits);

    // Fallback para BrasilAPI se ViaCEP falhar
    if (!result) {
      console.log('[GET /api/cep] ViaCEP falhou, tentando BrasilAPI...');
      result = await fetchBrasilApi(digits);
    }

    // Se ambos falharam
    if (!result) {
      return NextResponse.json(
        { error: "CEP não encontrado ou serviço indisponível" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/cep/[cep]] Error:', error);
    return NextResponse.json(
      { error: "Erro ao buscar CEP" },
      { status: 500 }
    );
  }
}

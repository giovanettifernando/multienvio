import 'server-only';
import { getAsaasConfig } from './config';
import { AsaasApiError } from './types';
import type { AsaasConfig } from './types';

export interface AsaasRequestDeps {
  getConfig?: () => Promise<AsaasConfig | null>;
  fetchImpl?: typeof fetch;
}

interface AsaasErrorBody {
  errors?: Array<{ code?: string; description?: string }>;
}

/**
 * Requisição autenticada à API do Asaas.
 *
 * O Asaas devolve erros no formato { errors: [{ code, description }] } — bem mais
 * descritivo que o do gateway anterior, então preservamos code e description.
 *
 * @throws AsaasApiError quando não configurado ou quando a API responde fora da faixa 2xx
 */
export async function asaasRequest<T>(
  path: string,
  options: RequestInit = {},
  deps: AsaasRequestDeps = {},
): Promise<T> {
  const getConfig = deps.getConfig ?? getAsaasConfig;
  const doFetch = deps.fetchImpl ?? fetch;

  const config = await getConfig();
  if (!config) {
    throw new AsaasApiError('NOT_CONFIGURED', 'Asaas não configurado');
  }

  const res = await doFetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: config.apiKey,
      'User-Agent': 'envio-legal/1.0',
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (!res.ok) {
    let code = 'API_ERROR';
    let message = `Asaas error ${res.status}`;
    try {
      const body = (await res.json()) as AsaasErrorBody;
      const first = body.errors?.[0];
      if (first?.description) message = first.description;
      if (first?.code) code = first.code;
    } catch {
      /* corpo não legível — mantém a mensagem genérica */
    }
    throw new AsaasApiError(code, message, res.status);
  }

  return res.json() as Promise<T>;
}

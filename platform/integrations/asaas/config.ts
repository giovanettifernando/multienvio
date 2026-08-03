/**
 * Configuração do Asaas.
 *
 * Prioridade: credencial ativa no banco (criptografada) > variáveis de ambiente.
 * Diferente do Pagar.me, o Asaas usa uma única chave — não há par público/secreto.
 */

import { prisma } from '@/platform/db/db';
import { decrypt } from '@/platform/integrations/shared/encryption.service';
import type { AsaasConfig } from './types';

const ASAAS_SLUG = 'asaas';
const CACHE_TTL = 5 * 60 * 1000;

let configCache: { config: AsaasConfig | null; timestamp: number } | null = null;

export async function getAsaasConfig(): Promise<AsaasConfig | null> {
  if (configCache && Date.now() - configCache.timestamp < CACHE_TTL) {
    return configCache.config;
  }

  try {
    const gateway = await prisma.paymentGateway.findFirst({
      where: { slug: ASAAS_SLUG, status: 'ACTIVE' },
      include: {
        credentials: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (gateway && gateway.credentials.length > 0) {
      const cred = gateway.credentials[0];
      const apiKey = cred.accessToken ? decrypt(cred.accessToken) : '';

      if (!apiKey) {
        console.warn('[ASAAS_CONFIG] Credencial sem chave de API no banco');
        return cacheAndReturn(getFallbackConfig());
      }

      return cacheAndReturn({
        apiKey,
        baseUrl: gateway.baseUrl || 'https://api-sandbox.asaas.com',
        webhookToken: cred.clientSecret ? decrypt(cred.clientSecret) : process.env.ASAAS_WEBHOOK_TOKEN,
        sandboxMode: gateway.environment === 'SANDBOX',
      });
    }

    return cacheAndReturn(getFallbackConfig());
  } catch (error) {
    console.error('[ASAAS_CONFIG] Erro ao buscar configuração:', error);
    return cacheAndReturn(getFallbackConfig());
  }
}

function cacheAndReturn(config: AsaasConfig | null): AsaasConfig | null {
  configCache = { config, timestamp: Date.now() };
  return config;
}

function getFallbackConfig(): AsaasConfig | null {
  const apiKey = process.env.ASAAS_API_KEY;
  const baseUrl = process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com';

  if (!apiKey) {
    console.warn(
      '[ASAAS_CONFIG] Asaas não configurado. Configure via admin ou defina ASAAS_API_KEY',
    );
    return null;
  }

  return {
    apiKey,
    baseUrl,
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
    sandboxMode: baseUrl.includes('sandbox'),
  };
}

/** Deve ser chamado após atualizar credenciais no admin. */
export function invalidateAsaasConfigCache(): void {
  configCache = null;
}

export async function isAsaasConfigured(): Promise<boolean> {
  return (await getAsaasConfig()) !== null;
}

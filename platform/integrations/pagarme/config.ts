/**
 * Serviço de configuração do Pagar.me
 *
 * Busca credenciais do banco de dados (PaymentGateway + PaymentCredential)
 * com fallback para variáveis de ambiente
 */

import { prisma } from '@/platform/db/db';
import { decrypt } from '@/platform/integrations/shared/encryption.service';
import type { PagarmeConfig } from './types';

const PAGARME_SLUG = 'pagarme';

/**
 * Cache in-memory da configuração (válido por 5 minutos)
 */
let configCache: {
  config: PagarmeConfig | null;
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Busca configuração ativa do Pagar.me
 *
 * Ordem de prioridade:
 * 1. Banco de dados (PaymentGateway + PaymentCredential)
 * 2. Variáveis de ambiente
 *
 * @returns Configuração do Pagar.me ou null se não configurado
 */
export async function getPagarmeConfig(): Promise<PagarmeConfig | null> {
  // Verificar cache
  if (configCache && Date.now() - configCache.timestamp < CACHE_TTL) {
    return configCache.config;
  }

  try {
    // Buscar do banco de dados
    const gateway = await prisma.paymentGateway.findFirst({
      where: {
        slug: PAGARME_SLUG,
        status: 'ACTIVE',
      },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (gateway && gateway.credentials.length > 0) {
      const cred = gateway.credentials[0];

      // Descriptografar campos sensíveis
      const secretKey = cred.accessToken ? decrypt(cred.accessToken) : '';
      const publicKey = cred.publicKey || '';

      if (!secretKey || !publicKey) {
        console.warn('[PAGARME_CONFIG] Credenciais incompletas no banco de dados');
        return getFallbackConfig();
      }

      const config: PagarmeConfig = {
        secretKey,
        publicKey,
        baseUrl: gateway.baseUrl || 'https://api.pagar.me/core/v5',
        sandboxMode: gateway.environment === 'SANDBOX',
      };

      configCache = { config, timestamp: Date.now() };
      return config;
    }

    // Fallback para variáveis de ambiente
    return getFallbackConfig();
  } catch (error) {
    console.error('[PAGARME_CONFIG] Erro ao buscar configuração:', error);
    return getFallbackConfig();
  }
}

/**
 * Configuração de fallback usando variáveis de ambiente
 */
function getFallbackConfig(): PagarmeConfig | null {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  const publicKey = process.env.PAGARME_PUBLIC_KEY;
  const baseUrl = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5';

  if (!secretKey || !publicKey) {
    console.warn(
      '[PAGARME_CONFIG] Pagar.me não configurado. ' +
        'Configure via admin ou defina PAGARME_SECRET_KEY e PAGARME_PUBLIC_KEY'
    );
    return null;
  }

  const config: PagarmeConfig = {
    secretKey,
    publicKey,
    baseUrl,
    sandboxMode: baseUrl.includes('sdx-api'),
  };

  configCache = { config, timestamp: Date.now() };
  return config;
}

/**
 * Invalida o cache de configuração
 * Deve ser chamado após atualizar credenciais no admin
 */
export function invalidatePagarmeConfigCache(): void {
  configCache = null;
}

/**
 * Verifica se o Pagar.me está configurado
 */
export async function isPagarmeConfigured(): Promise<boolean> {
  const config = await getPagarmeConfig();
  return config !== null;
}

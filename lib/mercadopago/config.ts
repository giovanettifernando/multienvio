/**
 * Serviço de configuração do Mercado Pago
 *
 * Busca credenciais do banco de dados (PaymentGateway + PaymentCredential)
 * com fallback para variáveis de ambiente
 */

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/integrations/shared/encryption.service';
import type { MercadoPagoConfig } from './types';

const MERCADO_PAGO_SLUG = 'mercadopago';

/**
 * Cache in-memory da configuração (válido por 5 minutos)
 */
let configCache: {
  config: MercadoPagoConfig | null;
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Busca configuração ativa do Mercado Pago
 *
 * Ordem de prioridade:
 * 1. Banco de dados (PaymentGateway + PaymentCredential)
 * 2. Variáveis de ambiente
 *
 * @returns Configuração do Mercado Pago ou null se não configurado
 */
export async function getMercadoPagoConfig(): Promise<MercadoPagoConfig | null> {
  // Verificar cache
  if (configCache && Date.now() - configCache.timestamp < CACHE_TTL) {
    return configCache.config;
  }

  try {
    // Buscar do banco de dados
    const gateway = await prisma.paymentGateway.findFirst({
      where: {
        slug: MERCADO_PAGO_SLUG,
        status: 'ACTIVE',
      },
      include: {
        credentials: {
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (gateway && gateway.credentials.length > 0) {
      const credential = gateway.credentials[0];

      // Descriptografar campos sensíveis
      const publicKey = credential.publicKey || '';
      const accessToken = credential.accessToken ? decrypt(credential.accessToken) : '';

      // SECURITY: Never log credentials, even partially

      if (!publicKey || !accessToken) {
        console.warn('[MERCADO_PAGO_CONFIG] Credenciais incompletas no banco de dados');
        return getFallbackConfig();
      }

      const config: MercadoPagoConfig = {
        publicKey,
        accessToken,
        webhookSecret: credential.secretKey ? decrypt(credential.secretKey) : undefined,
        sandboxMode: gateway.environment === 'SANDBOX',
      };

      // Atualizar cache
      configCache = {
        config,
        timestamp: Date.now(),
      };

      return config;
    }

    // Fallback para variáveis de ambiente
    return getFallbackConfig();
  } catch (error) {
    console.error('[MERCADO_PAGO_CONFIG] Erro ao buscar configuração:', error);
    return getFallbackConfig();
  }
}

/**
 * Configuração de fallback usando variáveis de ambiente
 */
function getFallbackConfig(): MercadoPagoConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!publicKey || !accessToken) {
    console.warn(
      '[MERCADO_PAGO_CONFIG] Mercado Pago não configurado. ' +
        'Configure via admin ou defina NEXT_PUBLIC_MP_PUBLIC_KEY e MP_ACCESS_TOKEN'
    );
    return null;
  }

  const config: MercadoPagoConfig = {
    publicKey,
    accessToken,
    webhookSecret: process.env.MP_WEBHOOK_SECRET,
    sandboxMode: process.env.MP_SANDBOX_MODE === 'true',
  };

  // Atualizar cache
  configCache = {
    config,
    timestamp: Date.now(),
  };

  return config;
}

/**
 * Invalida o cache de configuração
 * Deve ser chamado após atualizar credenciais no admin
 */
export function invalidateConfigCache(): void {
  configCache = null;
}

/**
 * Verifica se o Mercado Pago está configurado
 */
export async function isMercadoPagoConfigured(): Promise<boolean> {
  const config = await getMercadoPagoConfig();
  return config !== null;
}

/**
 * Busca apenas a Public Key (usada no frontend)
 */
export async function getMercadoPagoPublicKey(): Promise<string | null> {
  const config = await getMercadoPagoConfig();
  return config?.publicKey || null;
}

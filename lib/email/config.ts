/**
 * Serviço de configuração de email
 *
 * Busca configurações SMTP do banco de dados
 */

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/integrations/shared/encryption.service';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

/**
 * Cache da configuração de email
 * Evita buscar do banco em toda requisição
 */
let cachedConfig: EmailConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Busca configuração ativa de email do banco
 *
 * Retorna null se não houver configuração ativa
 * Cache de 5 minutos para reduzir queries
 */
export async function getEmailConfig(): Promise<EmailConfig | null> {
  const now = Date.now();

  // Retornar do cache se ainda válido
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    // Buscar configuração ativa do banco
    const config = await prisma.emailConfig.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      cachedConfig = null;
      cacheTimestamp = now;
      return null;
    }

    // Descriptografar senha
    const decryptedPassword = decrypt(config.password);

    const emailConfig: EmailConfig = {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      password: decryptedPassword,
      fromAddress: config.fromAddress,
      fromName: config.fromName,
    };

    // Atualizar cache
    cachedConfig = emailConfig;
    cacheTimestamp = now;

    return emailConfig;
  } catch (error) {
    console.error('[EMAIL_CONFIG] Erro ao buscar configuração:', error);
    return null;
  }
}

/**
 * Invalida o cache de configuração
 * Útil após salvar nova configuração
 */
export function invalidateEmailConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

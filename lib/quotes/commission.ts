/**
 * Serviço de comissões da plataforma
 *
 * Gerencia a aplicação de comissões sobre frete e taxa de coleta.
 * As comissões são transparentes para o usuário final.
 */

import { prisma } from '@/lib/db';
import type { Decimal } from '@prisma/client/runtime/client';

export interface PlatformCommissionConfig {
  shippingCommissionPercent: number;
  pickupFeeCommissionPercent: number;
  isActive: boolean;
}

// Cache em memória para configuração de comissões
let commissionCache: PlatformCommissionConfig | null = null;
let cacheExpiresAt: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Invalida o cache de comissões
 * Chamado quando a configuração é alterada no admin
 */
export function invalidatePlatformCommissionCache(): void {
  commissionCache = null;
  cacheExpiresAt = 0;
}

/**
 * Busca a configuração de comissões ativa
 * Usa cache em memória para evitar queries repetidas
 */
export async function getPlatformCommissionConfig(): Promise<PlatformCommissionConfig> {
  const now = Date.now();

  // Verificar cache
  if (commissionCache && now < cacheExpiresAt) {
    return commissionCache;
  }

  // Buscar do banco
  const config = await prisma.platformCommission.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  // Configuração padrão se não houver registro
  const result: PlatformCommissionConfig = {
    shippingCommissionPercent: config ? Number(config.shippingCommissionPercent) : 0,
    pickupFeeCommissionPercent: config ? Number(config.pickupFeeCommissionPercent) : 0,
    isActive: config?.isActive ?? true,
  };

  // Atualizar cache
  commissionCache = result;
  cacheExpiresAt = now + CACHE_TTL_MS;

  return result;
}

/**
 * Aplica a comissão da plataforma sobre um valor de frete
 *
 * @param basePrice Preço base do frete (sem comissão)
 * @returns Objeto com preço final e valor da comissão
 */
export async function applyShippingCommission(basePrice: number): Promise<{
  finalPrice: number;
  commissionAmount: number;
  commissionPercent: number;
}> {
  const config = await getPlatformCommissionConfig();

  if (!config.isActive || config.shippingCommissionPercent <= 0) {
    return {
      finalPrice: basePrice,
      commissionAmount: 0,
      commissionPercent: 0,
    };
  }

  const commissionMultiplier = 1 + config.shippingCommissionPercent / 100;
  const finalPrice = basePrice * commissionMultiplier;
  const commissionAmount = finalPrice - basePrice;

  return {
    finalPrice: Math.round(finalPrice * 100) / 100, // Arredonda para 2 casas
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    commissionPercent: config.shippingCommissionPercent,
  };
}

/**
 * Aplica a comissão da plataforma sobre uma taxa de coleta
 *
 * @param baseFee Taxa base de coleta (sem comissão)
 * @returns Objeto com taxa final e valor da comissão
 */
export async function applyPickupFeeCommission(baseFee: number): Promise<{
  finalFee: number;
  commissionAmount: number;
  commissionPercent: number;
}> {
  const config = await getPlatformCommissionConfig();

  if (!config.isActive || config.pickupFeeCommissionPercent <= 0) {
    return {
      finalFee: baseFee,
      commissionAmount: 0,
      commissionPercent: 0,
    };
  }

  const commissionMultiplier = 1 + config.pickupFeeCommissionPercent / 100;
  const finalFee = baseFee * commissionMultiplier;
  const commissionAmount = finalFee - baseFee;

  return {
    finalFee: Math.round(finalFee * 100) / 100,
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    commissionPercent: config.pickupFeeCommissionPercent,
  };
}

/**
 * Calcula comissões em centavos para registro no shipment
 *
 * @param freightCostCents Custo do frete em centavos (já com comissão aplicada)
 * @param pickupFeeCents Taxa de coleta em centavos (já com comissão aplicada)
 * @returns Valores de comissão em centavos
 */
export async function calculateCommissionsInCents(
  freightCostCents: number,
  pickupFeeCents: number
): Promise<{
  shippingCommissionCents: number;
  pickupCommissionCents: number;
}> {
  const config = await getPlatformCommissionConfig();

  if (!config.isActive) {
    return {
      shippingCommissionCents: 0,
      pickupCommissionCents: 0,
    };
  }

  // Calcular valor da comissão a partir do valor final
  // Se o preço final = base * (1 + percent/100), então:
  // comissão = final - base = final - (final / (1 + percent/100))
  // comissão = final * (1 - 1/(1 + percent/100))
  // comissão = final * (percent/100) / (1 + percent/100)

  let shippingCommissionCents = 0;
  if (config.shippingCommissionPercent > 0 && freightCostCents > 0) {
    const multiplier = config.shippingCommissionPercent / 100;
    shippingCommissionCents = Math.round(
      freightCostCents * (multiplier / (1 + multiplier))
    );
  }

  let pickupCommissionCents = 0;
  if (config.pickupFeeCommissionPercent > 0 && pickupFeeCents > 0) {
    const multiplier = config.pickupFeeCommissionPercent / 100;
    pickupCommissionCents = Math.round(
      pickupFeeCents * (multiplier / (1 + multiplier))
    );
  }

  return {
    shippingCommissionCents,
    pickupCommissionCents,
  };
}

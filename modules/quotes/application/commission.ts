/**
 * Servico de comissoes da plataforma
 *
 * Gerencia a aplicacao de comissoes sobre frete e taxa de coleta.
 * - Comissao de frete: especifica por transportadora (Carrier.shippingCommissionPercent)
 * - Comissao de coleta: geral da plataforma (PlatformCommission.pickupFeeCommissionPercent)
 */

import { prisma } from '@/platform/db/db';

export interface PlatformCommissionConfig {
  pickupFeeCommissionPercent: number;
  isActive: boolean;
}

// Cache em memoria para configuracao de comissoes da plataforma (taxa de coleta)
let platformCommissionCache: PlatformCommissionConfig | null = null;
let platformCacheExpiresAt: number = 0;

// Cache em memoria para comissoes por transportadora
const carrierCommissionCache = new Map<string, { percent: number; expiresAt: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Invalida o cache de comissoes da plataforma
 * Chamado quando a configuracao e alterada no admin
 */
export function invalidatePlatformCommissionCache(): void {
  platformCommissionCache = null;
  platformCacheExpiresAt = 0;
}

/**
 * Invalida o cache de comissao de uma transportadora especifica
 * Chamado quando a configuracao da transportadora e alterada
 */
export function invalidateCarrierCommissionCache(carrierSlug?: string): void {
  if (carrierSlug) {
    carrierCommissionCache.delete(carrierSlug);
  } else {
    carrierCommissionCache.clear();
  }
}

/**
 * Busca a configuracao de comissoes da plataforma (taxa de coleta)
 * Usa cache em memoria para evitar queries repetidas
 */
export async function getPlatformCommissionConfig(): Promise<PlatformCommissionConfig> {
  const now = Date.now();

  // Verificar cache
  if (platformCommissionCache && now < platformCacheExpiresAt) {
    return platformCommissionCache;
  }

  // Buscar do banco
  const config = await prisma.platformCommission.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  // Configuracao padrao se nao houver registro
  const result: PlatformCommissionConfig = {
    pickupFeeCommissionPercent: config ? Number(config.pickupFeeCommissionPercent) : 0,
    isActive: config?.isActive ?? true,
  };

  // Atualizar cache
  platformCommissionCache = result;
  platformCacheExpiresAt = now + CACHE_TTL_MS;

  return result;
}

/**
 * Busca a comissao de frete de uma transportadora especifica
 * Usa cache em memoria para evitar queries repetidas
 *
 * @param carrierSlug Slug da transportadora (ex: "correios")
 * @returns Percentual de comissao (0 se nao configurado)
 */
export async function getCarrierShippingCommissionPercent(carrierSlug: string): Promise<number> {
  const now = Date.now();

  // Verificar cache
  const cached = carrierCommissionCache.get(carrierSlug);
  if (cached && now < cached.expiresAt) {
    return cached.percent;
  }

  // Buscar do banco
  const carrier = await prisma.carrier.findFirst({
    where: { slug: carrierSlug, status: 'ACTIVE' },
    select: { shippingCommissionPercent: true },
  });

  const percent = carrier?.shippingCommissionPercent
    ? Number(carrier.shippingCommissionPercent)
    : 0;

  // Atualizar cache
  carrierCommissionCache.set(carrierSlug, {
    percent,
    expiresAt: now + CACHE_TTL_MS,
  });

  return percent;
}

/**
 * Aplica a comissao de frete da transportadora sobre um valor de frete
 *
 * @param basePrice Preco base do frete (sem comissao)
 * @param carrierSlug Slug da transportadora (ex: "correios")
 * @returns Objeto com preco final e valor da comissao
 */
export async function applyShippingCommission(
  basePrice: number,
  carrierSlug: string
): Promise<{
  finalPrice: number;
  commissionAmount: number;
  commissionPercent: number;
}> {
  const commissionPercent = await getCarrierShippingCommissionPercent(carrierSlug);

  if (commissionPercent <= 0) {
    return {
      finalPrice: basePrice,
      commissionAmount: 0,
      commissionPercent: 0,
    };
  }

  const commissionMultiplier = 1 + commissionPercent / 100;
  const finalPrice = basePrice * commissionMultiplier;
  const commissionAmount = finalPrice - basePrice;

  return {
    finalPrice: Math.round(finalPrice * 100) / 100, // Arredonda para 2 casas
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    commissionPercent,
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
 * Calcula comissoes em centavos para registro no shipment
 *
 * @param freightCostCents Custo do frete em centavos (ja com comissao aplicada)
 * @param pickupFeeCents Taxa de coleta em centavos (ja com comissao aplicada)
 * @param carrierSlug Slug da transportadora (ex: "correios")
 * @returns Valores de comissao em centavos
 */
export async function calculateCommissionsInCents(
  freightCostCents: number,
  pickupFeeCents: number,
  carrierSlug: string
): Promise<{
  shippingCommissionCents: number;
  pickupCommissionCents: number;
}> {
  const [shippingCommissionPercent, platformConfig] = await Promise.all([
    getCarrierShippingCommissionPercent(carrierSlug),
    getPlatformCommissionConfig(),
  ]);

  // Calcular valor da comissao a partir do valor final
  // Se o preco final = base * (1 + percent/100), entao:
  // comissao = final - base = final - (final / (1 + percent/100))
  // comissao = final * (1 - 1/(1 + percent/100))
  // comissao = final * (percent/100) / (1 + percent/100)

  let shippingCommissionCents = 0;
  if (shippingCommissionPercent > 0 && freightCostCents > 0) {
    const multiplier = shippingCommissionPercent / 100;
    shippingCommissionCents = Math.round(
      freightCostCents * (multiplier / (1 + multiplier))
    );
  }

  let pickupCommissionCents = 0;
  if (platformConfig.isActive && platformConfig.pickupFeeCommissionPercent > 0 && pickupFeeCents > 0) {
    const multiplier = platformConfig.pickupFeeCommissionPercent / 100;
    pickupCommissionCents = Math.round(
      pickupFeeCents * (multiplier / (1 + multiplier))
    );
  }

  return {
    shippingCommissionCents,
    pickupCommissionCents,
  };
}

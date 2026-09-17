/**
 * Servico de comissoes da plataforma
 *
 * Gerencia a aplicacao de comissoes sobre frete e seguro.
 * - Comissao de frete: especifica por transportadora (Carrier.shippingCommissionPercent)
 * - Comissao de seguro: especifica por transportadora (Carrier.insuranceCommissionPercent)
 */

import { prisma } from '@/platform/db/db';

// Cache em memoria para comissoes por transportadora
const carrierCommissionCache = new Map<string, { percent: number; expiresAt: number }>();
const carrierInsuranceCommissionCache = new Map<string, { percent: number; expiresAt: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Invalida o cache de comissao de uma transportadora especifica
 * Chamado quando a configuracao da transportadora e alterada
 */
export function invalidateCarrierCommissionCache(carrierSlug?: string): void {
  if (carrierSlug) {
    carrierCommissionCache.delete(carrierSlug);
    carrierInsuranceCommissionCache.delete(carrierSlug);
  } else {
    carrierCommissionCache.clear();
    carrierInsuranceCommissionCache.clear();
  }
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
 * Calcula comissoes em centavos para registro no shipment
 *
 * @param freightCostCents Custo do frete em centavos (ja com comissao aplicada)
 * @param carrierSlug Slug da transportadora (ex: "correios")
 * @returns Valores de comissao em centavos
 */
export async function calculateCommissionsInCents(
  freightCostCents: number,
  carrierSlug: string
): Promise<{
  shippingCommissionCents: number;
}> {
  const shippingCommissionPercent = await getCarrierShippingCommissionPercent(carrierSlug);

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

  return {
    shippingCommissionCents,
  };
}

/**
 * Descobre a transportadora de uma opção de cotação pelo id.
 *
 * Todos os adaptadores geram o id como `${slug}-${serviço}`, com o mesmo slug
 * cadastrado em `carriers`. Antes isto era uma cadeia de ifs que testava só
 * 'loggi-' e 'jt-' e mandava TODO o resto para 'correios' — a Total Express
 * caía nesse padrão e era cobrada com a comissão dos Correios (20%), enquanto a
 * configuração dela própria não tinha efeito nenhum.
 *
 * Slug desconhecido devolve null e o chamador não aplica comissão: errar para
 * menos é preferível a cobrar do cliente a taxa de outra transportadora.
 */
const CARRIER_SLUGS = ['total-express', 'correios', 'loggi', 'jt'] as const;

export function resolveCarrierSlug(optionId: string): string | null {
  // Mais longo primeiro, para um slug não engolir o prefixo de outro.
  const slugs = [...CARRIER_SLUGS].sort((a, b) => b.length - a.length);
  return slugs.find((slug) => optionId.startsWith(`${slug}-`)) ?? null;
}

/**
 * Mesma resolução, a partir do nome de exibição da transportadora.
 *
 * No checkout só sobra o nome ("Total Express", "J&T Express") — o id da opção
 * não é guardado no carrinho. Sem isto, o checkout registrava a comissão dos
 * Correios para todo mundo em um dos fluxos, e comissão zero no outro (porque
 * "total express", com espaço, nunca bate com o slug "total-express").
 */
export function resolveCarrierSlugByName(carrierName: string): string | null {
  const normalized = carrierName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (normalized.includes('correio')) return 'correios';
  if (normalized.includes('loggi')) return 'loggi';
  if (normalized.includes('totalexpress')) return 'total-express';
  if (normalized.startsWith('jt')) return 'jt';

  return null;
}

/**
 * Percentual de comissao de seguro da transportadora (pontos percentuais
 * somados sobre o valor declarado).
 */
export async function getCarrierInsuranceCommissionPercent(carrierSlug: string): Promise<number> {
  const now = Date.now();
  const cached = carrierInsuranceCommissionCache.get(carrierSlug);
  if (cached && now < cached.expiresAt) {
    return cached.percent;
  }

  const carrier = await prisma.carrier.findFirst({
    where: { slug: carrierSlug, status: 'ACTIVE' },
    select: { insuranceCommissionPercent: true },
  });

  const percent = carrier?.insuranceCommissionPercent
    ? Number(carrier.insuranceCommissionPercent)
    : 0;

  carrierInsuranceCommissionCache.set(carrierSlug, {
    percent,
    expiresAt: now + CACHE_TTL_MS,
  });

  return percent;
}

/**
 * Comissao de seguro sobre um valor declarado.
 *
 * A conta e direta — percentual sobre o valor que o cliente declarou — e nao
 * sobre a tarifa da transportadora. Isso e o que permite valer para as quatro:
 * so os Correios informam quanto cobram de valor declarado separadamente.
 *
 * @returns Valor em reais a somar ao preco da opcao. Zero se nao houver seguro.
 */
export async function calculateInsuranceCommission(
  declaredValue: number | null | undefined,
  carrierSlug: string
): Promise<{ commissionAmount: number; commissionPercent: number }> {
  if (!declaredValue || declaredValue <= 0) {
    return { commissionAmount: 0, commissionPercent: 0 };
  }

  const commissionPercent = await getCarrierInsuranceCommissionPercent(carrierSlug);
  if (commissionPercent <= 0) {
    return { commissionAmount: 0, commissionPercent: 0 };
  }

  // Arredonda para centavos: o preco da cotacao circula em reais decimais e
  // fracoes de centavo viram divergencia entre cotacao e cobranca.
  const commissionAmount = Math.round(declaredValue * commissionPercent) / 100;

  return { commissionAmount, commissionPercent };
}

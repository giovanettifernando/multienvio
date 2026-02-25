/**
 * Cart Checkout Service
 *
 * Centraliza a lógica de negócio do checkout de carrinho, separando-a da rota HTTP.
 * Responsabilidades:
 * - Validar carrinho e itens
 * - Verificar saldo da carteira (se aplicável)
 * - Criar shipments a partir dos itens
 * - Integrar com transportadoras
 * - Gerenciar idempotência
 * - Limpar itens processados
 */

import { Prisma, PrismaClient, Package, CartItem } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '@/platform/db/db';
import { createShipmentWithVolumes } from '@/modules/shipments/application/create-with-volumes';
// Eventos de rastreamento virão dos Correios via webhook/sync
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { calculateCommissionsInCents } from '@/modules/quotes/application/commission';
import { integrateWithCarrier } from '@/modules/shipments/application/carrier-integration';
import { logger } from '@/platform/logging/logger';
import { ApiError } from '@/platform/api/errors';
import { isCorreiosCarrier } from '@/shared/utils/carrier';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import type { LabelGenerateJobPayload } from '@/platform/queue';

// ============================================================================
// TYPES
// ============================================================================

export interface CartCheckoutInput {
  userId: string;
  itemIds?: string[];
  paymentMethod?: string;
}

export interface CartCheckoutResult {
  idempotent: boolean;
  cartId: string;
  shipmentIds: string[];
  totalAmount: number;
}

// Internal types for cart data
interface CartItemTotals {
  total?: number;
  [key: string]: unknown;
}

interface CartItemOriginAddress {
  cep: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  nome?: string;
}

interface CartItemDestination {
  nome?: string;
  apelido?: string;
  telefone?: string;
  email?: string;
  documento?: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface CartItemVolume {
  pesoKg?: number;
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;
  [key: string]: unknown;
}

interface CartItemQuote {
  carrier: string;
  serviceName?: string;
  serviceCode?: string;
  deadlineDays: number;
  price: number;
}

interface CartItemPickupPoint {
  id?: string | null;
}

interface CartItemPickupFee {
  feeAmount?: number;
  collectorId?: string;
}

interface CartItemPreferences {
  pickupRequested?: boolean;
}

interface CartItemDocument {
  type?: string;
  [key: string]: unknown;
}

interface CartMeta {
  lastCheckoutFingerprint?: string;
  shipmentIds?: string[];
  totalAmount?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gera fingerprint para idempotência baseado nos IDs dos itens
 */
function generateCheckoutFingerprint(cartId: string, itemIds: string[]): string {
  const itemsHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(itemIds))
    .digest('hex')
    .substring(0, 16);
  return `${cartId}-${itemsHash}`;
}

/**
 * Calcula o total dos itens selecionados
 */
function calculateItemsTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotals = item.totals as CartItemTotals;
    return sum + (itemTotals?.total || 0);
  }, 0);
}

/**
 * Determina o status inicial do shipment baseado no tipo de coleta
 */
function determineInitialStatus(hasPickupRequest: boolean, pickupPointId: string | null): ShipmentStatus {
  if (hasPickupRequest) {
    return ShipmentStatus.PICKUP_REQUESTED;
  }
  return ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
}

/**
 * Gera código de rastreamento único da plataforma
 */
function generatePlatformTrackingCode(): string {
  return `EL${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Verifica saldo da carteira antes do checkout
 */
async function verifyWalletBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  totalAmount: number
): Promise<void> {
  const wallets = await tx.$queryRaw<Array<{ id: string; availableCents: number }>>`
    SELECT id, "availableCents"
    FROM "wallets"
    WHERE "userId" = ${userId}
    FOR UPDATE
  `;

  const wallet = wallets[0];
  const availableCents = wallet?.availableCents ?? 0;

  if (availableCents < totalAmount * 100) {
    throw new ApiError({
      code: 'INSUFFICIENT_WALLET_BALANCE',
      message: 'Saldo insuficiente na carteira para processar o checkout',
      status: 402,
    });
  }
}

/**
 * Processa retorno idempotente - checkout já foi processado anteriormente
 */
async function handleIdempotentCheckout(
  tx: Prisma.TransactionClient,
  cartId: string,
  itemsToCheckout: CartItem[],
  existingCheckout: CartMeta
): Promise<CartCheckoutResult> {
  // Garantir que itens sejam removidos (pode ter falhado anteriormente)
  const processedItemIds = itemsToCheckout.map((item) => item.id);
  await tx.cartItem.deleteMany({
    where: {
      id: { in: processedItemIds },
      cartId,
    },
  });

  // Recalcular totais
  const remainingItems = await tx.cartItem.findMany({
    where: { cartId },
  });

  const newTotal = calculateItemsTotal(remainingItems);

  await tx.cart.update({
    where: { id: cartId },
    data: {
      status: 'OPEN',
      totals: { total: newTotal, moeda: 'BRL' },
    },
  });

  logger.info({
    event: 'checkout_idempotent',
    cartId,
    processedCount: processedItemIds.length,
    remainingCount: remainingItems.length,
  }, 'Idempotent checkout detected, items removed');

  return {
    idempotent: true,
    cartId,
    shipmentIds: existingCheckout.shipmentIds || [],
    totalAmount: existingCheckout.totalAmount ?? 0,
  };
}

/**
 * Cria um shipment a partir de um item do carrinho
 */
async function createShipmentFromCartItem(
  tx: Prisma.TransactionClient,
  userId: string,
  item: CartItem
): Promise<{ shipmentId: string; itemTotal: number; packages: Package[] }> {
  const originAddress = item.originAddress as unknown as CartItemOriginAddress;
  const destination = item.destination as unknown as CartItemDestination;
  const volumes = item.volumes as unknown as CartItemVolume[];
  const preferences = item.preferences as unknown as CartItemPreferences | null;
  const selectedQuote = item.selectedQuote as unknown as CartItemQuote;
  const pickupFeeData = item.pickupFee as unknown as CartItemPickupFee | null;
  const itemDocument = item.document as unknown as CartItemDocument | null;

  // Valor declarado
  const declaredValue = item.insuranceValue ? Number(item.insuranceValue) : 0;

  // Gerar tracking code
  const platformTrackingCode = generatePlatformTrackingCode();

  // Determinar status inicial
  const pickupPointId = item.pickupPoint
    ? (item.pickupPoint as CartItemPickupPoint).id || null
    : null;
  const hasPickupRequest = preferences?.pickupRequested === true;
  const initialStatus = determineInitialStatus(hasPickupRequest, pickupPointId);

  // Calcular comissoes
  const pickupFeeAmount = pickupFeeData?.feeAmount ?? 0;
  const freightCostCents = Math.round(selectedQuote.price * 100);
  const pickupFeeCents = Math.round(pickupFeeAmount * 100);
  // Determinar carrierSlug baseado no nome da transportadora
  const carrierSlug = selectedQuote.carrier.toLowerCase().includes('correio') ? 'correios' : 'correios';
  const { shippingCommissionCents, pickupCommissionCents } = await calculateCommissionsInCents(
    freightCostCents,
    pickupFeeCents,
    carrierSlug
  );

  // Construir documento do shipment
  const shipmentDocument = itemDocument?.type
    ? itemDocument
    : {
        originAddress: item.originAddress,
        destination: item.destination,
        volumes: item.volumes,
        preferences: item.preferences,
        selectedQuote: item.selectedQuote,
        totals: item.totals,
      };

  // Criar shipment COM VOLUMES
  const { shipment, packages } = await createShipmentWithVolumes(tx, {
    shipment: {
      platformTrackingCode,
      carrierTrackingCode: null,
      senderId: userId,
      recipientName: destination.nome || destination.apelido || 'Destinatário',
      recipientPhone: destination.telefone,
      recipientEmail: destination.email,
      recipientDocument: destination.documento,
      originCep: originAddress.cep,
      destinationCep: destination.cep,
      destinationAddress: [destination.logradouro, destination.numero, destination.complemento]
        .filter(Boolean)
        .join(', '),
      destinationNeighborhood: destination.bairro,
      destinationCity: destination.cidade,
      destinationState: destination.uf,
      declaredValue,
      carrier: selectedQuote.carrier,
      service: selectedQuote.serviceName || selectedQuote.serviceCode,
      estimatedDays: selectedQuote.deadlineDays,
      freightCost: selectedQuote.price,
      pickupPointId,
      document: shipmentDocument as Prisma.InputJsonValue,
      status: initialStatus,
      paymentMethod: null,
      platformShippingCommissionCents: shippingCommissionCents > 0 ? shippingCommissionCents : null,
      platformPickupCommissionCents: pickupCommissionCents > 0 ? pickupCommissionCents : null,
    },
    volumes: volumes.map((vol) => ({
      peso: vol.pesoKg || 0,
      altura: vol.alturaCm || 0,
      largura: vol.larguraCm || 0,
      comprimento: vol.comprimentoCm || 0,
    })),
  });

  // Criar etiqueta
  await tx.label.create({
    data: {
      shipmentId: shipment.id,
      carrier: selectedQuote.carrier,
      service: selectedQuote.serviceName || selectedQuote.serviceCode || '',
      status: 'pending',
      priceCents: Math.round(selectedQuote.price * 100),
      currency: 'BRL',
      trackingCode: platformTrackingCode,
      recipientName: destination.nome || destination.apelido || 'Destinatário',
      isPrinted: false,
    },
  });

  // Integração com transportadora (best-effort)
  await integrateWithCarrierSafely(tx, userId, shipment.id, packages, {
    carrier: selectedQuote.carrier,
    serviceName: selectedQuote.serviceName || '',
    serviceCode: selectedQuote.serviceCode,
    originAddress,
    destination,
    declaredValue,
  });

  // Criar PickupRequest se solicitado
  if (hasPickupRequest) {
    await createPickupRequestIfNeeded(tx, userId, shipment.id, originAddress, pickupFeeData);
  }

  // Eventos de rastreamento virão dos Correios via webhook/sync
  // Não criar evento inicial genérico - API pública tem fallback para timeline vazia

  // Calcular total do item
  const itemTotals = item.totals as CartItemTotals;
  const itemTotal = itemTotals?.total;

  if (!itemTotal || itemTotal <= 0) {
    throw new ApiError({
      code: 'INVALID_ITEM_TOTAL',
      message: `Item ${item.id} possui total inválido: ${itemTotal}`,
      status: 400,
    });
  }

  return { shipmentId: shipment.id, itemTotal, packages };
}

/**
 * Integra com a transportadora de forma segura (não bloqueia checkout em caso de erro)
 */
async function integrateWithCarrierSafely(
  tx: Prisma.TransactionClient,
  userId: string,
  shipmentId: string,
  packages: Package[],
  params: {
    carrier: string;
    serviceName: string;
    serviceCode?: string;
    originAddress: CartItemOriginAddress;
    destination: CartItemDestination;
    declaredValue: number;
  }
): Promise<void> {
  try {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        razaoSocial: true,
        email: true,
        phone: true,
        cpf: true,
        cnpj: true,
      },
    });

    const senderDocumento =
      (user?.cnpj && user.cnpj.trim() !== '' ? user.cnpj : null) ||
      user?.cpf ||
      '';

    const senderData = {
      nome: user?.razaoSocial || user?.name || 'Remetente',
      documento: senderDocumento.replace(/\D/g, ''),
      telefone: user?.phone || undefined,
      email: user?.email || undefined,
      cep: params.originAddress.cep.replace(/\D/g, ''),
      logradouro: params.originAddress.logradouro || undefined,
      numero: params.originAddress.numero || undefined,
      complemento: params.originAddress.complemento || undefined,
      bairro: params.originAddress.bairro || undefined,
      cidade: params.originAddress.cidade || undefined,
      uf: params.originAddress.uf || undefined,
    };

    logger.debug({
      event: 'checkout_sender_data',
      shipmentId,
      hasUserData: !!user,
      documento: senderData.documento ? `${senderData.documento.substring(0, 3)}***` : 'MISSING',
      nome: senderData.nome,
      cep: senderData.cep,
    }, 'Prepared sender data for carrier integration');

    const recipientData = {
      nome: params.destination.nome || params.destination.apelido || 'Destinatário',
      documento: params.destination.documento,
      telefone: params.destination.telefone,
      email: params.destination.email,
      cep: params.destination.cep,
      logradouro: params.destination.logradouro,
      numero: params.destination.numero,
      complemento: params.destination.complemento,
      bairro: params.destination.bairro,
      cidade: params.destination.cidade,
      uf: params.destination.uf,
    };

    const integrationResult = await integrateWithCarrier(tx, {
      shipmentId,
      carrier: params.carrier,
      serviceName: params.serviceName,
      serviceCode: params.serviceCode,
      packages,
      sender: senderData,
      recipient: recipientData,
      declaredValue: params.declaredValue,
      contentDescription: 'Mercadorias diversas',
    });

    if (integrationResult.success) {
      logger.info({
        event: 'checkout_carrier_success',
        shipmentId,
        carrier: params.carrier,
        primaryTrackingCode: integrationResult.primaryTrackingCode,
        packagesUpdated: integrationResult.packageUpdates?.length || 0,
      }, 'Carrier integration successful');
    } else {
      logger.warn({
        event: 'checkout_carrier_failed',
        shipmentId,
        carrier: params.carrier,
        error: integrationResult.errorMessage,
        errors: integrationResult.errors,
      }, 'Carrier integration failed (non-blocking)');
    }
  } catch (integrationError) {
    logger.error({
      event: 'checkout_carrier_error',
      shipmentId,
      carrier: params.carrier,
      err: integrationError,
    }, 'Carrier integration error (non-blocking)');
  }
}

/**
 * Cria PickupRequest se coleta foi solicitada
 */
async function createPickupRequestIfNeeded(
  tx: Prisma.TransactionClient,
  userId: string,
  shipmentId: string,
  originAddress: CartItemOriginAddress,
  pickupFeeData: CartItemPickupFee | null
): Promise<void> {
  const collectorId = pickupFeeData?.collectorId || null;

  // Verificar se já existe (idempotência)
  const existingPickup = await tx.pickupRequest.findUnique({
    where: { shipmentId },
  });

  if (!existingPickup) {
    await tx.pickupRequest.create({
      data: {
        userId,
        shipmentId,
        collectorId,
        originCep: originAddress.cep,
        originAddress: null,
        originCity: originAddress.cidade || null,
        originUf: originAddress.uf || null,
        status: 'PENDING',
        notes: null,
      },
    });
  }
}

/**
 * Remove itens processados e atualiza totais do carrinho
 */
async function cleanupProcessedItems(
  tx: Prisma.TransactionClient,
  cartId: string,
  itemsToCheckout: CartItem[]
): Promise<void> {
  const processedItemIds = itemsToCheckout.map((item) => item.id);
  await tx.cartItem.deleteMany({
    where: {
      id: { in: processedItemIds },
      cartId,
    },
  });

  const remainingItems = await tx.cartItem.findMany({
    where: { cartId },
  });

  const newTotal = calculateItemsTotal(remainingItems);

  await tx.cart.update({
    where: { id: cartId },
    data: {
      status: 'OPEN',
      totals: { total: newTotal, moeda: 'BRL' },
    },
  });

  logger.info({
    event: 'checkout_items_removed',
    cartId,
    processedCount: processedItemIds.length,
    remainingCount: remainingItems.length,
  }, 'Items removed after checkout');
}

// ============================================================================
// MAIN SERVICE FUNCTION
// ============================================================================

/**
 * Processa checkout do carrinho
 *
 * Fluxo:
 * 1. Busca carrinho OPEN com lock
 * 2. Valida itens selecionados
 * 3. Verifica saldo da carteira (se aplicável)
 * 4. Verifica idempotência
 * 5. Cria shipments para cada item
 * 6. Remove itens processados
 * 7. Atualiza meta do carrinho
 */
export async function processCartCheckout(input: CartCheckoutInput): Promise<CartCheckoutResult> {
  // Track carriers for post-transaction LABEL_GENERATE enqueue
  const nonCorreiosShipments: Array<{ shipmentId: string; carrier: string }> = [];

  const result = await prisma.$transaction(async (tx) => {
    // Buscar carrinho OPEN
    const cart = await tx.cart.findFirst({
      where: {
        userId: input.userId,
        status: 'OPEN',
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cart) {
      throw new ApiError({ code: 'CART_NOT_FOUND', message: 'Carrinho não encontrado', status: 404 });
    }

    if (cart.items.length === 0) {
      throw new ApiError({ code: 'CART_EMPTY', message: 'Carrinho vazio', status: 400 });
    }

    // Filtrar itens se itemIds fornecido
    const itemsToCheckout = input.itemIds?.length
      ? cart.items.filter((item) => input.itemIds?.includes(item.id))
      : cart.items;

    if (itemsToCheckout.length === 0) {
      throw new ApiError({ code: 'NO_ITEMS_SELECTED', message: 'Nenhum item selecionado para checkout', status: 400 });
    }

    // Verificar saldo da carteira (se método de pagamento for carteira)
    if (input.paymentMethod === 'wallet') {
      const totalAmountPreview = calculateItemsTotal(itemsToCheckout);
      await verifyWalletBalance(tx, input.userId, totalAmountPreview);
    }

    // Gerar fingerprint para idempotência
    const checkoutFingerprint = generateCheckoutFingerprint(
      cart.id,
      itemsToCheckout.map((i) => i.id)
    );

    // Verificar idempotência
    const existingCheckout = cart.meta as CartMeta | null;
    if (
      existingCheckout?.lastCheckoutFingerprint === checkoutFingerprint &&
      existingCheckout?.shipmentIds &&
      existingCheckout.shipmentIds.length > 0
    ) {
      return handleIdempotentCheckout(tx, cart.id, itemsToCheckout, existingCheckout);
    }

    // Travar carrinho
    await tx.cart.update({
      where: { id: cart.id },
      data: { status: 'LOCKED' },
    });

    // Criar shipments para cada item
    const shipmentIds: string[] = [];
    let totalAmount = 0;

    for (const item of itemsToCheckout) {
      const selectedQuote = item.selectedQuote as unknown as CartItemQuote;
      const { shipmentId, itemTotal } = await createShipmentFromCartItem(tx, input.userId, item);
      shipmentIds.push(shipmentId);
      if (!isCorreiosCarrier(selectedQuote.carrier)) {
        nonCorreiosShipments.push({ shipmentId, carrier: selectedQuote.carrier });
      }
      totalAmount += itemTotal;
    }

    // Atualizar meta do carrinho
    await tx.cart.update({
      where: { id: cart.id },
      data: {
        meta: {
          lastCheckoutFingerprint: checkoutFingerprint,
          lastCheckoutAt: new Date().toISOString(),
          shipmentIds,
          totalAmount,
        },
      },
    });

    // Remover itens processados
    await cleanupProcessedItems(tx, cart.id, itemsToCheckout);

    return {
      idempotent: false,
      cartId: cart.id,
      shipmentIds,
      totalAmount,
    };
  });

  // Enfileirar LABEL_GENERATE para carriers não-Correios (após commit da transação)
  if (!result.idempotent && nonCorreiosShipments.length > 0) {
    for (const { shipmentId, carrier } of nonCorreiosShipments) {
      try {
        const labelQueue = getQueue<LabelGenerateJobPayload>(QUEUE_NAMES.LABEL_GENERATE);
        const isLoggi = carrier.toLowerCase() === 'loggi';
        await labelQueue.add('generate', { shipmentId, carrier }, {
          priority: JOB_PRIORITY.HIGH,
          jobId: `label-${shipmentId}`,
          delay: isLoggi ? 60_000 : 0,
        });
      } catch (err) {
        logger.warn({
          event: 'label_generate_enqueue_failed',
          shipmentId,
          error: err instanceof Error ? err.message : String(err),
        }, 'Failed to enqueue LABEL_GENERATE');
      }
    }
  }

  return result;
}

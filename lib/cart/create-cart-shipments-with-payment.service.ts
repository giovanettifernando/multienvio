/**
 * Create Cart Shipments With Payment Service
 *
 * Cria shipments do carrinho SOMENTE após confirmação de pagamento.
 * Usa códigos de rastreamento reservados previamente.
 *
 * Fluxo:
 * 1. Usuário abre modal de checkout do carrinho
 * 2. Frontend reserva N códigos (um por item)
 * 3. Usuário confirma pagamento
 * 4. Este service é chamado com os códigos reservados
 * 5. Débito + criação de shipments acontece atomicamente
 * 6. Emails são enviados aos destinatários
 */

import { Prisma, Package, CartItem } from '@prisma/client';
import { prisma } from '@/lib/db';
import { createShipmentWithVolumes } from '@/lib/shipments/create-with-volumes';
import { createInitialTrackingEvent } from '@/lib/tracking/create-event';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { calculateCommissionsInCents } from '@/lib/quotes/commission';
import { integrateWithCarrier } from '@/lib/shipments/carrier-integration';
import { sendShipmentTrackingEmail } from '@/lib/email/mailer';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type CartPaymentMethod = 'WALLET' | 'MERCADO_PAGO';

export interface CreateCartShipmentsInput {
  userId: string;
  /** Códigos reservados (um por item, na mesma ordem) */
  reservedTrackingCodes: string[];
  /** IDs dos itens do carrinho a processar */
  itemIds: string[];
  /** Método de pagamento */
  paymentMethod: CartPaymentMethod;
  /** ID do pagamento MercadoPago (se aplicável) */
  mercadoPagoPaymentId?: string;
}

export interface CreateCartShipmentsResult {
  shipmentIds: string[];
  trackingCodes: string[];
  walletTransactionId: string | null;
  totalAmount: number;
  isIdempotent: boolean;
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * Calcula o total dos itens selecionados
 */
function calculateItemsTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotals = item.totals as CartItemTotals;
    return sum + (itemTotals?.total || 0);
  }, 0);
}

/**
 * Gera o título da transação do carrinho
 * Formato: "Pagamento do carrinho (EL123, EL456, ...)"
 */
function generateCartTransactionTitle(trackingCodes: string[]): string {
  const codeList = trackingCodes.join(', ');
  return `Pagamento do carrinho (${codeList})`;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

/**
 * Cria shipments do carrinho após confirmação de pagamento.
 * Operação atômica: débito + criação dos shipments.
 */
export async function createCartShipmentsWithPayment(
  input: CreateCartShipmentsInput
): Promise<CreateCartShipmentsResult> {
  const {
    userId,
    reservedTrackingCodes,
    itemIds,
    paymentMethod,
    mercadoPagoPaymentId,
  } = input;

  // Validar que temos códigos para todos os itens
  if (reservedTrackingCodes.length !== itemIds.length) {
    throw Object.assign(
      new Error(`Número de códigos reservados (${reservedTrackingCodes.length}) não corresponde ao número de itens (${itemIds.length})`),
      { code: 'TRACKING_CODE_MISMATCH' }
    );
  }

  logger.info({
    event: 'create_cart_shipments_start',
    userId,
    itemCount: itemIds.length,
    paymentMethod,
    trackingCodes: reservedTrackingCodes,
  }, 'Starting cart shipments creation with payment');

  // ReferenceId baseado nos códigos de rastreamento
  const referenceId = `cart:${reservedTrackingCodes.join(',')}`;

  const result = await prisma.$transaction(async (tx) => {
    // 1) IDEMPOTÊNCIA: Verificar se já existe transação com este referenceId
    const existingTransaction = await tx.walletTransaction.findUnique({
      where: { referenceId },
    });

    if (existingTransaction) {
      logger.info({
        event: 'create_cart_shipments_idempotent',
        referenceId,
        transactionId: existingTransaction.id,
      }, 'Returning existing transaction (idempotent)');

      // Buscar shipments existentes
      const existingShipments = await tx.shipment.findMany({
        where: { platformTrackingCode: { in: reservedTrackingCodes } },
        select: { id: true, platformTrackingCode: true },
      });

      return {
        shipmentIds: existingShipments.map(s => s.id),
        trackingCodes: existingShipments.map(s => s.platformTrackingCode),
        walletTransactionId: existingTransaction.id,
        totalAmount: existingTransaction.amountCents / 100,
        isIdempotent: true,
      };
    }

    // 2) VALIDAR CÓDIGOS RESERVADOS (P0: userId + P1: expiração)
    const now = new Date();
    const validReservations = await tx.trackingCodeReservation.findMany({
      where: {
        code: { in: reservedTrackingCodes },
        userId: userId, // P0: Códigos devem pertencer ao usuário
        usedAt: null,   // Ainda não usados
        expiresAt: { gt: now }, // P1: Não expirados
      },
      select: { code: true },
    });

    const validCodes = new Set(validReservations.map(r => r.code));
    const invalidCodes = reservedTrackingCodes.filter(code => !validCodes.has(code));

    if (invalidCodes.length > 0) {
      logger.warn({
        event: 'invalid_tracking_codes',
        invalidCodes,
        userId,
      }, 'Invalid, expired, or unauthorized tracking codes');

      throw Object.assign(
        new Error(`Código(s) de rastreamento inválido(s), expirado(s) ou não autorizado(s): ${invalidCodes.join(', ')}`),
        { code: 'INVALID_TRACKING_CODE' }
      );
    }

    // 3) BUSCAR CARRINHO E ITENS
    const cart = await tx.cart.findFirst({
      where: {
        userId,
        status: { in: ['OPEN', 'LOCKED'] },
      },
      include: {
        items: {
          where: { id: { in: itemIds } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw Object.assign(new Error('Carrinho ou itens não encontrados'), { code: 'CART_NOT_FOUND' });
    }

    if (cart.items.length !== itemIds.length) {
      throw Object.assign(
        new Error(`Alguns itens não foram encontrados. Esperado: ${itemIds.length}, Encontrado: ${cart.items.length}`),
        { code: 'ITEMS_NOT_FOUND' }
      );
    }

    // Calcular total
    const totalAmount = calculateItemsTotal(cart.items);
    const amountCents = Math.round(totalAmount * 100);

    // 3) TRAVAR CARRINHO
    await tx.cart.update({
      where: { id: cart.id },
      data: { status: 'LOCKED' },
    });

    // 4) PAGAMENTO COM CARTEIRA: Debitar saldo
    let walletTransactionId: string | null = null;

    if (paymentMethod === 'WALLET') {
      // Buscar carteira COM LOCK para evitar race condition
      const wallets = await tx.$queryRaw<Array<{
        id: string;
        userId: string;
        availableCents: number;
        pendingCents: number;
      }>>`
        SELECT id, "userId", "availableCents", "pendingCents"
        FROM "wallets"
        WHERE "userId" = ${userId}
        FOR UPDATE
      `;

      const wallet = wallets[0];

      if (!wallet) {
        throw Object.assign(new Error('Carteira não encontrada'), { code: 'WALLET_NOT_FOUND' });
      }

      // Verificar saldo
      if (wallet.availableCents < amountCents) {
        throw Object.assign(new Error('Saldo insuficiente na carteira'), { code: 'INSUFFICIENT_FUNDS' });
      }

      // Debitar carteira
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableCents: { decrement: amountCents },
        },
      });

      // Criar transação na carteira com título correto
      const transactionTitle = generateCartTransactionTitle(reservedTrackingCodes);

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PURCHASE',
          amountCents,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          title: transactionTitle,
          referenceId,
          meta: {
            trackingCodes: reservedTrackingCodes,
            reason: 'cart_payment',
            itemCount: cart.items.length,
            totalAmount,
          },
        },
      });

      walletTransactionId = walletTransaction.id;

      // Criar entrada no ledger
      await tx.ledgerEntry.create({
        data: {
          type: 'CHARGE',
          amountCents,
          accountType: 'WALLET',
          accountId: wallet.id,
          description: transactionTitle,
          metadata: {
            trackingCodes: reservedTrackingCodes,
            userId,
            walletTransactionId: walletTransaction.id,
            itemCount: cart.items.length,
          },
        },
      });

      logger.info({
        event: 'wallet_debit_success',
        walletTransactionId,
        amountCents,
        title: transactionTitle,
      }, 'Wallet debited successfully for cart');
    }

    // 5) CRIAR SHIPMENTS para cada item
    const shipmentIds: string[] = [];
    const shipmentsData: Array<{
      shipmentId: string;
      trackingCode: string;
      recipientEmail: string | null;
      recipientName: string;
      destinationCity: string;
      destinationState: string;
    }> = [];

    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i];
      const trackingCode = reservedTrackingCodes[i];

      const shipmentResult = await createShipmentFromCartItem(
        tx,
        userId,
        item,
        trackingCode,
        paymentMethod,
        walletTransactionId,
        mercadoPagoPaymentId,
        totalAmount
      );

      shipmentIds.push(shipmentResult.shipmentId);
      shipmentsData.push({
        shipmentId: shipmentResult.shipmentId,
        trackingCode,
        recipientEmail: shipmentResult.recipientEmail,
        recipientName: shipmentResult.recipientName,
        destinationCity: shipmentResult.destinationCity,
        destinationState: shipmentResult.destinationState,
      });

      // Marcar reserva como usada
      await tx.trackingCodeReservation.updateMany({
        where: {
          code: trackingCode,
          userId: userId, // P0: Garantir que pertence ao usuário
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
          shipmentId: shipmentResult.shipmentId,
        },
      });
    }

    // 6) REMOVER ITENS DO CARRINHO
    await tx.cartItem.deleteMany({
      where: {
        id: { in: itemIds },
        cartId: cart.id,
      },
    });

    // 7) VERIFICAR SE CARRINHO FICOU VAZIO E ATUALIZAR STATUS
    const remainingItems = await tx.cartItem.count({
      where: { cartId: cart.id },
    });

    if (remainingItems === 0) {
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CHECKED_OUT' },
      });
    } else {
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'OPEN' },
      });
    }

    return {
      shipmentIds,
      trackingCodes: reservedTrackingCodes,
      walletTransactionId,
      totalAmount,
      isIdempotent: false,
      _shipmentsData: shipmentsData,
    };
  });

  // 8) ENVIAR EMAILS (fora da transação, não bloqueia)
  if (!result.isIdempotent) {
    sendCartTrackingEmailsAsync(userId, result._shipmentsData || []);
  }

  logger.info({
    event: 'create_cart_shipments_success',
    shipmentIds: result.shipmentIds,
    trackingCodes: result.trackingCodes,
    totalAmount: result.totalAmount,
    isIdempotent: result.isIdempotent,
  }, 'Cart shipments created successfully');

  return {
    shipmentIds: result.shipmentIds,
    trackingCodes: result.trackingCodes,
    walletTransactionId: result.walletTransactionId,
    totalAmount: result.totalAmount,
    isIdempotent: result.isIdempotent,
  };
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Cria um shipment a partir de um item do carrinho com código reservado
 */
async function createShipmentFromCartItem(
  tx: Prisma.TransactionClient,
  userId: string,
  item: CartItem,
  trackingCode: string,
  paymentMethod: CartPaymentMethod,
  walletTransactionId: string | null,
  mercadoPagoPaymentId: string | undefined,
  totalAmount: number
): Promise<{
  shipmentId: string;
  itemTotal: number;
  packages: Package[];
  recipientEmail: string | null;
  recipientName: string;
  destinationCity: string;
  destinationState: string;
}> {
  const originAddress = item.originAddress as unknown as CartItemOriginAddress;
  const destination = item.destination as unknown as CartItemDestination;
  const volumes = item.volumes as unknown as CartItemVolume[];
  const preferences = item.preferences as unknown as CartItemPreferences | null;
  const selectedQuote = item.selectedQuote as unknown as CartItemQuote;
  const pickupFeeData = item.pickupFee as unknown as CartItemPickupFee | null;
  const itemDocument = item.document as unknown as CartItemDocument | null;

  // Valor declarado
  const declaredValue = item.insuranceValue ? Number(item.insuranceValue) : 0;

  // Determinar status inicial
  const pickupPointId = item.pickupPoint
    ? (item.pickupPoint as CartItemPickupPoint).id || null
    : null;
  const hasPickupRequest = preferences?.pickupRequested === true;
  const initialStatus = determineInitialStatus(hasPickupRequest, pickupPointId);

  // Calcular comissões
  const pickupFeeAmount = pickupFeeData?.feeAmount ?? 0;
  const freightCostCents = Math.round(selectedQuote.price * 100);
  const pickupFeeCents = Math.round(pickupFeeAmount * 100);
  const { shippingCommissionCents, pickupCommissionCents } = await calculateCommissionsInCents(
    freightCostCents,
    pickupFeeCents
  );

  // Construir documento do shipment
  const shipmentDocument = itemDocument?.type
    ? {
        ...itemDocument,
        payment: {
          status: 'approved',
          method: paymentMethod.toLowerCase(),
          confirmedAt: new Date().toISOString(),
          ...(walletTransactionId && { walletTransactionId }),
          ...(mercadoPagoPaymentId && { mercadoPagoPaymentId }),
          amount: totalAmount,
        },
      }
    : {
        originAddress: item.originAddress,
        destination: item.destination,
        volumes: item.volumes,
        preferences: item.preferences,
        selectedQuote: item.selectedQuote,
        totals: item.totals,
        payment: {
          status: 'approved',
          method: paymentMethod.toLowerCase(),
          confirmedAt: new Date().toISOString(),
          ...(walletTransactionId && { walletTransactionId }),
          ...(mercadoPagoPaymentId && { mercadoPagoPaymentId }),
          amount: totalAmount,
        },
      };

  // Criar shipment COM VOLUMES usando código reservado
  const { shipment, packages } = await createShipmentWithVolumes(tx, {
    shipment: {
      platformTrackingCode: trackingCode, // Código reservado
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
      paymentMethod, // JÁ DEFINIDO
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

  // Criar etiqueta (já emitida - pagamento confirmado)
  await tx.label.create({
    data: {
      shipmentId: shipment.id,
      carrier: selectedQuote.carrier,
      service: selectedQuote.serviceName || selectedQuote.serviceCode || '',
      status: 'issued', // Já emitida
      priceCents: Math.round(selectedQuote.price * 100),
      currency: 'BRL',
      trackingCode,
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
    const collectorId = pickupFeeData?.collectorId || null;
    const existingPickup = await tx.pickupRequest.findUnique({
      where: { shipmentId: shipment.id },
    });

    if (!existingPickup) {
      await tx.pickupRequest.create({
        data: {
          userId,
          shipmentId: shipment.id,
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

  // Criar evento inicial de rastreamento
  await createInitialTrackingEvent(tx, shipment.id, initialStatus, new Date());

  // Calcular total do item
  const itemTotals = item.totals as CartItemTotals;
  const itemTotal = itemTotals?.total || 0;

  return {
    shipmentId: shipment.id,
    itemTotal,
    packages,
    recipientEmail: destination.email || null,
    recipientName: destination.nome || destination.apelido || 'Destinatário',
    destinationCity: destination.cidade,
    destinationState: destination.uf,
  };
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
        event: 'cart_carrier_integration_success',
        shipmentId,
        carrier: params.carrier,
      }, 'Carrier integration successful');
    } else {
      logger.warn({
        event: 'cart_carrier_integration_failed',
        shipmentId,
        carrier: params.carrier,
        error: integrationResult.errorMessage,
      }, 'Carrier integration failed (non-blocking)');
    }
  } catch (integrationError) {
    logger.error({
      event: 'cart_carrier_integration_error',
      shipmentId,
      carrier: params.carrier,
      err: integrationError,
    }, 'Carrier integration error (non-blocking)');
  }
}

/**
 * Envia emails de rastreamento de forma assíncrona
 */
async function sendCartTrackingEmailsAsync(
  userId: string,
  shipmentsData: Array<{
    shipmentId: string;
    trackingCode: string;
    recipientEmail: string | null;
    recipientName: string;
    destinationCity: string;
    destinationState: string;
  }>
): Promise<void> {
  try {
    // Buscar nome do remetente
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, razaoSocial: true },
    });
    const senderName = sender?.razaoSocial || sender?.name || 'Remetente';

    for (const shipment of shipmentsData) {
      if (!shipment.recipientEmail || shipment.recipientEmail.trim() === '') {
        continue;
      }

      try {
        const sent = await sendShipmentTrackingEmail(
          shipment.recipientEmail,
          shipment.recipientName,
          shipment.trackingCode,
          senderName,
          shipment.destinationCity,
          shipment.destinationState
        );

        if (sent) {
          logger.info({
            event: 'cart_tracking_email_sent',
            trackingCode: shipment.trackingCode,
            recipientEmail: shipment.recipientEmail,
          }, 'Tracking email sent to recipient');
        }
      } catch (emailError) {
        logger.error({
          event: 'cart_tracking_email_error',
          trackingCode: shipment.trackingCode,
          err: emailError,
        }, 'Error sending tracking email');
      }
    }
  } catch (error) {
    logger.error({
      event: 'cart_tracking_emails_batch_error',
      err: error,
    }, 'Error sending cart tracking emails');
  }
}

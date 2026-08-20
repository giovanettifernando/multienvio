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
import { prisma } from '@/platform/db/db';
import { createShipmentWithVolumes } from '@/modules/shipments/application/create-with-volumes';
// Eventos de rastreamento virão dos Correios via webhook/sync
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { calculateCommissionsInCents, calculateInsuranceCommission, resolveCarrierSlugByName } from '@/modules/quotes/application/commission';
import { integrateWithCarrier } from '@/modules/shipments/application/carrier-integration';
import { sendShipmentTrackingEmail } from '@/platform/email/mailer';
import { logger } from '@/platform/logging/logger';
import { isCorreiosCarrier } from '@/shared/utils/carrier';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import { canReleaseService } from '@/platform/integrations/asaas/release';
import type { LabelGenerateJobPayload, ShipmentCreateJobPayload } from '@/platform/queue';

// ============================================================================
// TYPES
// ============================================================================

export type CartPaymentMethod = 'WALLET' | 'PAGARME';

export interface CreateCartShipmentsInput {
  userId: string;
  /** Códigos reservados (um por item, na mesma ordem) */
  reservedTrackingCodes: string[];
  /** IDs dos itens do carrinho a processar */
  itemIds: string[];
  /** Método de pagamento */
  paymentMethod: CartPaymentMethod;
  /** ID do pagamento (legacy, não utilizado) */
  mercadoPagoPaymentId?: string;
  /** ID da PaymentTransaction do gateway (Asaas), se aplicável.
   *  Nome mantido como "pagarmePaymentId" por compatibilidade de contrato com o
   *  frontend (CheckoutCartModal / PaidCheckoutModal já enviam esta chave). */
  pagarmePaymentId?: string;
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
    pagarmePaymentId,
  } = input;

  // Track non-Correios shipments for post-transaction LABEL_GENERATE enqueue
  const nonCorreiosShipments: Array<{ shipmentId: string; carrier: string }> = [];

  // Track Correios shipments for post-transaction SHIPMENT_CREATE enqueue (integração assíncrona)
  const correiosShipments: Array<{
    shipmentId: string;
    carrier: string;
    service: string;
    declaredValue: number;
    targetStatus: string;
    originAddress: CartItemOriginAddress;
  }> = [];

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
    } else if (paymentMethod === 'PAGARME') {
      // Verificar a PaymentTransaction do gateway (Asaas) antes de liberar os
      // shipments. Três checagens antes do claim — canReleaseService sozinho
      // não fecha o risco:
      //   1) DONO: a transação tem que pertencer ao usuário da sessão, senão
      //      qualquer um reaproveita o id de uma transação paga alheia.
      //   2) STATUS: canReleaseService(status) — só CAPTURED ou PAID liberam.
      //   3) VALOR: a transação tem que cobrir o total deste carrinho, senão
      //      uma transação de centavos libera envios caros.
      // TODO(Task 14/15 - frontend): renomear o par pagarmePaymentId/PAGARME
      // para nomenclatura Asaas quando o frontend (CheckoutCartModal) for
      // atualizado — hoje o nome é mantido por compatibilidade de contrato.
      if (!pagarmePaymentId) {
        throw new Error('pagarmePaymentId is required for PAGARME payment');
      }
      const transaction = await tx.paymentTransaction.findUnique({
        where: { id: pagarmePaymentId },
      });
      if (
        !transaction ||
        transaction.userId !== userId ||
        !canReleaseService(transaction.status) ||
        transaction.amountCents < amountCents
      ) {
        throw Object.assign(
          new Error('Pagamento não encontrado ou não aprovado'),
          { code: 'PAGARME_PAYMENT_NOT_APPROVED' }
        );
      }

      // 4) REUSO — claim atômico: uma PaymentTransaction só pode liberar UM
      // checkout. `updateMany` com `WHERE consumedByReference IS NULL` é um
      // compare-and-swap real no Postgres — não uma checagem de aplicação: a
      // linha é bloqueada durante o UPDATE, então se duas requisições
      // concorrentes chegarem aqui com a mesma transação paga, a segunda só
      // executa depois que a primeira commita (ou desfaz), e nesse momento a
      // condição `consumedByReference: null` já não casa mais — count 0.
      // Mesmo desenho do claim atômico de RecipientPaymentRequest.status
      // (Task 12b) e do WalletTransaction.referenceId único.
      //
      // Não há liberação manual do claim se a criação dos shipments falhar
      // depois: este updateMany roda dentro da MESMA transação interativa
      // (prisma.$transaction(async (tx) => {...})) que cria os shipments —
      // se qualquer escrita subsequente lançar, o Postgres desfaz TUDO,
      // inclusive este claim, automaticamente. Um "release" manual no catch
      // seria redundante e arriscaria liberar um claim que na verdade foi
      // commitado.
      const claim = await tx.paymentTransaction.updateMany({
        where: { id: pagarmePaymentId, consumedByReference: null },
        data: { consumedByReference: referenceId },
      });

      if (claim.count === 0) {
        throw Object.assign(
          new Error('Este pagamento já foi utilizado para criar outros envios'),
          { code: 'PAGARME_PAYMENT_ALREADY_USED' }
        );
      }

      logger.info({
        event: 'pagarme_payment_verified',
        pagarmePaymentId,
        status: transaction.status,
      }, 'Gateway payment verified and claimed successfully');
    }

    // 5) CRIAR SHIPMENTS para cada item
    const shipmentIds: string[] = [];
    const shipmentsData: Array<{
      shipmentId: string;
      trackingCode: string;
      publicTrackingId: string | null;
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
        pagarmePaymentId,
        totalAmount
      );

      shipmentIds.push(shipmentResult.shipmentId);
      shipmentsData.push({
        shipmentId: shipmentResult.shipmentId,
        trackingCode,
        publicTrackingId: shipmentResult.publicTrackingId,
        recipientEmail: shipmentResult.recipientEmail,
        recipientName: shipmentResult.recipientName,
        destinationCity: shipmentResult.destinationCity,
        destinationState: shipmentResult.destinationState,
      });

      // Track carriers for post-transaction async processing
      const selectedQuote = item.selectedQuote as unknown as CartItemQuote;
      if (selectedQuote?.carrier) {
        if (isCorreiosCarrier(selectedQuote.carrier)) {
          // Correios: integração assíncrona via SHIPMENT_CREATE worker
          // Atualiza status para PROCESSING — worker define o status final após pré-postagem
          await tx.shipment.update({
            where: { id: shipmentResult.shipmentId },
            data: { status: 'PROCESSING' },
          });
          correiosShipments.push({
            shipmentId: shipmentResult.shipmentId,
            carrier: selectedQuote.carrier,
            service: selectedQuote.serviceName || selectedQuote.serviceCode || '',
            declaredValue: item.insuranceValue ? Number(item.insuranceValue) : 0,
            targetStatus: shipmentResult.targetStatus,
            originAddress: item.originAddress as unknown as CartItemOriginAddress,
          });
        } else {
          nonCorreiosShipments.push({ shipmentId: shipmentResult.shipmentId, carrier: selectedQuote.carrier });
        }
      }

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

  // 9) Enfileirar SHIPMENT_CREATE para Correios (integração assíncrona)
  if (!result.isIdempotent && correiosShipments.length > 0) {
    const shipmentCreateQueue = getQueue<ShipmentCreateJobPayload>(QUEUE_NAMES.SHIPMENT_CREATE);
    for (const { shipmentId, carrier, service, declaredValue, targetStatus, originAddress } of correiosShipments) {
      try {
        await shipmentCreateQueue.add('create', {
          shipmentId,
          userId,
          carrier,
          service,
          declaredValue,
          targetStatus,
          originAddress,
        }, {
          priority: JOB_PRIORITY.HIGH,
          jobId: `shipment-create-${shipmentId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
        });
      } catch (err) {
        logger.warn({
          event: 'correios_shipment_create_enqueue_failed',
          shipmentId,
          error: err instanceof Error ? err.message : String(err),
        }, 'Failed to enqueue SHIPMENT_CREATE for Correios');
      }
    }
  }

  // 10) Enfileirar LABEL_GENERATE para carriers não-Correios
  if (!result.isIdempotent && nonCorreiosShipments.length > 0) {
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
  pagarmePaymentId: string | undefined,
  totalAmount: number
): Promise<{
  shipmentId: string;
  itemTotal: number;
  packages: Package[];
  recipientEmail: string | null;
  recipientName: string;
  destinationCity: string;
  destinationState: string;
  publicTrackingId: string | null;
  targetStatus: string;
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

  // Calcular comissoes
  const pickupFeeAmount = pickupFeeData?.feeAmount ?? 0;
  const pickupFeeCents = Math.round(pickupFeeAmount * 100);
  const carrierSlug = resolveCarrierSlugByName(selectedQuote.carrier) ?? '';

  // O preco da cotacao ja vem com as duas comissoes somadas. A de frete e
  // recalculada de tras para frente a partir do preco, entao a de seguro
  // precisa sair antes — senao ela seria contada como receita de frete.
  const { commissionAmount: insuranceCommission } = await calculateInsuranceCommission(
    declaredValue,
    carrierSlug
  );
  const insuranceCommissionCents = Math.round(insuranceCommission * 100);
  const freightCostCents = Math.round(selectedQuote.price * 100) - insuranceCommissionCents;

  const { shippingCommissionCents, pickupCommissionCents } = await calculateCommissionsInCents(
    freightCostCents,
    pickupFeeCents,
    carrierSlug
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
          ...(pagarmePaymentId && { pagarmeTransactionId: pagarmePaymentId }),
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
          ...(pagarmePaymentId && { pagarmeTransactionId: pagarmePaymentId }),
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
      // Endereço de origem congelado no envio, no mesmo formato do destino
      // abaixo. Antes só o CEP era guardado e as telas não tinham como
      // mostrar de onde a encomenda saiu.
      originAddress: [originAddress.logradouro, originAddress.numero, originAddress.complemento]
        .filter(Boolean)
        .join(', ') || null,
      originNeighborhood: originAddress.bairro || null,
      originCity: originAddress.cidade || null,
      originState: originAddress.uf || null,
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
      platformInsuranceCommissionCents: insuranceCommissionCents > 0 ? insuranceCommissionCents : null,
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

  // Eventos de rastreamento virão dos Correios via webhook/sync
  // Não criar evento inicial genérico - API pública tem fallback para timeline vazia

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
    publicTrackingId: shipment.publicTrackingId,
    targetStatus: initialStatus,
  };
}

/**
 * Integra com a transportadora.
 * CORREIOS: Ignorado aqui — integração acontece de forma assíncrona via SHIPMENT_CREATE worker
 * OUTRAS: Best-effort (não bloqueia)
 *
 * Retorna true se integração foi realizada com sucesso, false caso contrário.
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
): Promise<boolean> {
  const isCorreios = isCorreiosCarrier(params.carrier);

  if (isCorreios) {
    // Correios: não chama API dentro da transação para evitar timeout e falha no checkout.
    // O SHIPMENT_CREATE worker faz a pré-postagem de forma assíncrona com retries automáticos.
    return false;
  }

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

  if (!integrationResult.success) {
    // OUTRAS TRANSPORTADORAS: Best-effort
    logger.warn({
      event: 'cart_carrier_integration_failed',
      shipmentId,
      carrier: params.carrier,
      error: integrationResult.errorMessage,
    }, 'Carrier integration failed (non-blocking for non-Correios)');
    return false;
  }

  logger.info({
    event: 'cart_carrier_integration_success',
    shipmentId,
    carrier: params.carrier,
  }, 'Carrier integration successful');
  return true;
}

/**
 * Envia emails de rastreamento de forma assíncrona
 */
async function sendCartTrackingEmailsAsync(
  userId: string,
  shipmentsData: Array<{
    shipmentId: string;
    trackingCode: string;
    publicTrackingId: string | null;
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
          shipment.destinationState,
          shipment.publicTrackingId,
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

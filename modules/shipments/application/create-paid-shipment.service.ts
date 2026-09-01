/**
 * Create Paid Shipment Service
 *
 * Cria shipment SOMENTE após confirmação de pagamento.
 * Garante atomicidade: débito + criação do shipment em uma única transação.
 *
 * Este service substitui o fluxo antigo onde:
 * 1. Shipment era criado com paymentMethod: null
 * 2. Pagamento era confirmado depois
 *
 * Novo fluxo:
 * 1. Pagamento é confirmado
 * 2. Shipment é criado com paymentMethod já definido
 * 3. Email é enviado ao destinatário
 */

import { prisma } from '@/platform/db/db';
import { assertSenderCanUseDeclaration } from '@/shared/validation/dce';
import { createShipmentWithVolumes } from '@/modules/shipments/application/create-with-volumes';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { logger } from '@/platform/logging/logger';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import type { ShipmentCreateJobPayload } from '@/platform/queue/types';
import { canReleaseService } from '@/platform/integrations/asaas/release';
import { calculateCommissionsInCents, calculateInsuranceCommission, resolveCarrierSlugByName } from '@/modules/quotes/application/commission';
import {
  CheckoutRecipient,
  CheckoutVolume,
  CheckoutDocument,
  CheckoutOriginAddress,
  calculateDeclaredValue,
  prepareDocumentData,
  determineInitialStatus,
  saveRecipientIfRequested,
} from '@/modules/cart/application/checkout.service';

// ============================================================================
// TIPOS
// ============================================================================

export type PaymentMethod = 'WALLET' | 'PAGARME';

export interface CreatePaidShipmentInput {
  userId: string;
  trackingCode: string; // Código reservado previamente
  recipient: CheckoutRecipient;
  document: CheckoutDocument;
  volumes: CheckoutVolume[];
  insuranceValue?: number;
  pickupPointId?: string | null;
  carrier: string;
  service: string;
  originCep: string;
  originCidade?: string;
  originUf?: string;
  originAddress?: CheckoutOriginAddress;
  destinationCep: string;
  estimatedDays: number;
  freightCost: number;
  totalCost: number; // Valor total a ser debitado (frete + taxa de coleta)
  solicitarColeta?: boolean;
  paymentMethod: PaymentMethod;
  /** ID externo do serviço (ex: externalServiceId da Loggi) */
  externalServiceId?: string;
  /** ID da PaymentTransaction do gateway (Asaas), para paymentMethod === 'PAGARME'.
   *  Nome mantido como "pagarmePaymentId" por compatibilidade de contrato com o
   *  frontend (PaidCheckoutModal já envia esta chave). */
  pagarmePaymentId?: string;
  // Dados de taxa de coleta (pickup fee)
  pickupFee?: {
    collectorId: string;
    feeAmount: number;
    distanceKm: number;
  };
}

export interface CreatePaidShipmentResult {
  shipmentId: string;
  trackingCode: string;
  publicTrackingId: string | null;
  labelId: string;
  pickupRequestId: string | null;
  walletTransactionId: string | null;
  isIdempotent: boolean;
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

/**
 * Cria um shipment após confirmação de pagamento.
 * Operação atômica: débito + criação do shipment.
 */
export async function createPaidShipment(
  input: CreatePaidShipmentInput
): Promise<CreatePaidShipmentResult> {
  const {
    userId,
    trackingCode,
    recipient,
    document,
    volumes,
    insuranceValue,
    pickupPointId,
    carrier,
    service,
    originCep,
    originCidade,
    originUf,
    originAddress,
    destinationCep,
    estimatedDays,
    freightCost,
    totalCost,
    solicitarColeta,
    paymentMethod,
    pagarmePaymentId,
    pickupFee,
  } = input;

  const declaredValue = calculateDeclaredValue(document, insuranceValue);

  // Mesma regra do checkout do carrinho: sem CPF/CNPJ do remetente não há
  // como emitir a DC-e, então o envio não deve nem ser criado.
  if (document.type === 'DECLARACAO') {
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { cpf: true, cnpj: true },
    });
    assertSenderCanUseDeclaration({ cpf: sender?.cpf ?? null, cnpj: sender?.cnpj ?? null });
  }
  const documentData = prepareDocumentData(document);
  const initialStatus = determineInitialStatus(solicitarColeta, pickupPointId);
  const amountCents = Math.round(totalCost * 100);
  const referenceId = `shipment:${trackingCode}`;

  logger.info({
    event: 'create_paid_shipment_start',
    trackingCode,
    userId,
    paymentMethod,
    totalCost,
  }, 'Starting paid shipment creation');

  const result = await prisma.$transaction(async (tx) => {
    // 1) IDEMPOTÊNCIA: Verificar se já existe shipment com este código
    const existingShipment = await tx.shipment.findFirst({
      where: { platformTrackingCode: trackingCode },
      include: {
        label: true,
        pickupRequest: true,
      },
    });

    if (existingShipment) {
      logger.info({
        event: 'create_paid_shipment_idempotent',
        trackingCode,
        shipmentId: existingShipment.id,
      }, 'Returning existing shipment (idempotent)');

      // Buscar transação existente
      const existingTransaction = await tx.walletTransaction.findUnique({
        where: { referenceId },
      });

      return {
        shipmentId: existingShipment.id,
        trackingCode: existingShipment.platformTrackingCode,
        publicTrackingId: existingShipment.publicTrackingId,
        labelId: existingShipment.label?.id || '',
        pickupRequestId: existingShipment.pickupRequest?.id || null,
        walletTransactionId: existingTransaction?.id || null,
        isIdempotent: true,
      };
    }

    // 2) VALIDAR CÓDIGO RESERVADO (P0: userId + P1: expiração)
    const reservation = await tx.trackingCodeReservation.findFirst({
      where: {
        code: trackingCode,
        userId: userId, // P0: Código deve pertencer ao usuário
        usedAt: null,   // Ainda não usado
        expiresAt: { gt: new Date() }, // P1: Não expirado
      },
    });

    if (!reservation) {
      logger.warn({
        event: 'invalid_tracking_code',
        trackingCode,
        userId,
      }, 'Invalid, expired, or unauthorized tracking code');

      throw Object.assign(
        new Error('Código de rastreamento inválido, expirado ou não autorizado'),
        { code: 'INVALID_TRACKING_CODE' }
      );
    }

    // 3) PAGAMENTO COM CARTEIRA: Debitar saldo
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
      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PURCHASE',
          amountCents,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          title: `Pagamento - ${trackingCode}`,
          referenceId,
          meta: {
            trackingCode,
            reason: 'shipment_payment',
            freightCost,
            ...(pickupFee && {
              pickupFee: pickupFee.feeAmount,
              collectorId: pickupFee.collectorId,
            }),
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
          description: `Pagamento - ${trackingCode}`,
          metadata: {
            trackingCode,
            userId,
            walletTransactionId: walletTransaction.id,
            freightCost,
            ...(pickupFee && {
              pickupFee: pickupFee.feeAmount,
            }),
          },
        },
      });

      logger.info({
        event: 'wallet_debit_success',
        trackingCode,
        walletTransactionId,
        amountCents,
      }, 'Wallet debited successfully');
    } else if (paymentMethod === 'PAGARME') {
      // Verificar a PaymentTransaction do gateway (Asaas) antes de liberar o
      // envio. Três checagens antes do claim — canReleaseService sozinho não
      // fecha o risco:
      //   1) DONO: a transação tem que pertencer ao usuário da sessão, senão
      //      qualquer um pode reaproveitar o id de uma transação paga alheia.
      //   2) STATUS: canReleaseService(status) — só CAPTURED ou PAID liberam.
      //   3) VALOR: a transação tem que cobrir o custo total deste envio,
      //      senão uma transação de centavos libera uma etiqueta cara.
      // TODO(Task 14/15 - frontend): renomear o par pagarmePaymentId/PAGARME
      // para nomenclatura Asaas quando o frontend (PaidCheckoutModal) for
      // atualizado — hoje o nome é mantido por compatibilidade de contrato.
      if (!pagarmePaymentId) {
        throw Object.assign(
          new Error('pagarmePaymentId is required for PAGARME payment'),
          { code: 'PAGARME_PAYMENT_REQUIRED' }
        );
      }

      const paymentTx = await tx.paymentTransaction.findUnique({
        where: { id: pagarmePaymentId },
      });

      if (
        !paymentTx ||
        paymentTx.userId !== userId ||
        !canReleaseService(paymentTx.status) ||
        paymentTx.amountCents < amountCents
      ) {
        throw Object.assign(
          new Error('Pagamento não encontrado ou não aprovado'),
          { code: 'PAGARME_PAYMENT_NOT_APPROVED' }
        );
      }

      // 4) REUSO — claim atômico: uma PaymentTransaction só pode liberar UM
      // envio. `updateMany` com `WHERE consumedByReference IS NULL` é um
      // compare-and-swap real no Postgres — não uma checagem de aplicação:
      // a linha é bloqueada durante o UPDATE, então se duas requisições
      // concorrentes chegarem aqui com a mesma transação paga, a segunda só
      // executa depois que a primeira commita (ou desfaz), e nesse momento a
      // condição `consumedByReference: null` já não casa mais — count 0.
      // Mesmo desenho do claim atômico de RecipientPaymentRequest.status
      // (Task 12b) e do WalletTransaction.referenceId único.
      //
      // Não há liberação manual do claim se a criação do shipment falhar
      // depois: este updateMany roda dentro da MESMA transação interativa
      // (prisma.$transaction(async (tx) => {...})) que cria o shipment — se
      // qualquer escrita subsequente lançar, o Postgres desfaz TUDO,
      // inclusive este claim, automaticamente. Um "release" manual no catch
      // seria redundante e arriscaria liberar um claim que na verdade foi
      // commitado.
      const claim = await tx.paymentTransaction.updateMany({
        where: { id: pagarmePaymentId, consumedByReference: null },
        data: { consumedByReference: referenceId },
      });

      if (claim.count === 0) {
        throw Object.assign(
          new Error('Este pagamento já foi utilizado para criar outro envio'),
          { code: 'PAGARME_PAYMENT_ALREADY_USED' }
        );
      }

      logger.info({
        event: 'pagarme_payment_verified',
        trackingCode,
        pagarmePaymentId,
        status: paymentTx.status,
      }, 'Gateway payment verified and claimed successfully');
    }

    // 3) CRIAR SHIPMENT com status PROCESSING (integração com transportadora é assíncrona)
    // Comissoes: este caminho nao registrava nenhuma delas — nem a de frete —
    // entao os envios criados por aqui ficavam de fora dos relatorios de
    // receita. Mesma conta dos fluxos de carrinho: a comissao de seguro sai do
    // preco antes do calculo reverso da de frete, senao a de frete incidiria
    // duas vezes sobre ela.
    const carrierSlug = resolveCarrierSlugByName(carrier) ?? '';
    const { commissionAmount: insuranceCommission } = await calculateInsuranceCommission(
      declaredValue,
      carrierSlug
    );
    const insuranceCommissionCents = Math.round(insuranceCommission * 100);
    const freightCostCents = Math.round(freightCost * 100) - insuranceCommissionCents;
    const { shippingCommissionCents, pickupCommissionCents } = await calculateCommissionsInCents(
      freightCostCents,
      Math.round((pickupFee?.feeAmount ?? 0) * 100),
      carrierSlug
    );

    const { shipment, packages } = await createShipmentWithVolumes(tx, {
      shipment: {
        platformTrackingCode: trackingCode,
        carrierTrackingCode: null,
        senderId: userId,
        recipientName: recipient.nome,
        recipientPhone: recipient.telefone ?? null,
        recipientEmail: recipient.email ?? null,
        recipientDocument: recipient.documento ?? null,
        originCep,
        // Endereço de origem congelado no envio (mesmo formato do destino).
        originAddress: [
          originAddress?.logradouro,
          originAddress?.numero,
          originAddress?.complemento,
        ].filter(Boolean).join(', ') || null,
        originNeighborhood: originAddress?.bairro ?? null,
        originCity: originAddress?.cidade ?? originCidade ?? null,
        originState: originAddress?.uf ?? originUf ?? null,
        destinationCep,
        destinationAddress: [
          recipient.logradouro,
          recipient.numero,
          recipient.complemento,
        ].filter(Boolean).join(', ') || null,
        destinationNeighborhood: recipient.bairro ?? null,
        destinationCity: recipient.cidade,
        destinationState: recipient.uf,
        declaredValue,
        carrier,
        service,
        estimatedDays,
        freightCost,
        pickupPointId,
        platformShippingCommissionCents: shippingCommissionCents > 0 ? shippingCommissionCents : null,
        platformPickupCommissionCents: pickupCommissionCents > 0 ? pickupCommissionCents : null,
        platformInsuranceCommissionCents: insuranceCommissionCents > 0 ? insuranceCommissionCents : null,
        document: {
          ...documentData as object,
          payment: {
            status: 'approved',
            method: paymentMethod.toLowerCase(),
            confirmedAt: new Date().toISOString(),
            ...(walletTransactionId && { walletTransactionId }),
            ...(pagarmePaymentId && { pagarmePaymentId }),
            amount: totalCost,
          },
        },
        status: ShipmentStatus.PROCESSING,
        paymentMethod, // JÁ DEFINIDO (não mais null)
      },
      volumes: volumes.map((vol) => ({
        peso: vol.peso,
        altura: vol.altura,
        largura: vol.largura,
        comprimento: vol.comprimento,
      })),
    });

    logger.info({
      event: 'shipment_created',
      trackingCode,
      shipmentId: shipment.id,
      paymentMethod,
      status: ShipmentStatus.PROCESSING,
    }, 'Shipment created with PROCESSING status — carrier integration will be async');

    // 4) CRIAR ETIQUETA (status pending — será preenchida pelo worker)
    const label = await tx.label.create({
      data: {
        shipmentId: shipment.id,
        carrier,
        service,
        status: 'pending', // Será atualizada pelo worker após integração
        priceCents: Math.round(freightCost * 100),
        currency: 'BRL',
        trackingCode,
        recipientName: recipient.nome,
        isPrinted: false,
      },
    });

    // 5) MARCAR RESERVA COMO USADA
    await tx.trackingCodeReservation.updateMany({
      where: {
        code: trackingCode,
        userId: userId, // P0: Garantir que pertence ao usuário
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
        shipmentId: shipment.id,
      },
    });

    // 6) CRIAR PICKUP REQUEST SE SOLICITADO
    let pickupRequestId: string | null = null;
    if (solicitarColeta) {
      const pickupRequest = await tx.pickupRequest.create({
        data: {
          userId,
          shipmentId: shipment.id,
          originCep,
          originAddress: null,
          originCity: originCidade || null,
          originUf: originUf || null,
          status: 'PENDING',
          notes: null,
        },
      });
      pickupRequestId = pickupRequest.id;
    }

    return {
      shipmentId: shipment.id,
      trackingCode: shipment.platformTrackingCode,
      publicTrackingId: shipment.publicTrackingId,
      labelId: label.id,
      pickupRequestId,
      walletTransactionId,
      isIdempotent: false,
    };
  });

  // 7) SALVAR DESTINATÁRIO RECORRENTE (fora da transação)
  await saveRecipientIfRequested(userId, recipient);

  // 8) ENFILEIRAR JOB DE INTEGRAÇÃO COM TRANSPORTADORA (assíncrono via BullMQ)
  if (!result.isIdempotent) {
    const originAddr = originAddress || {
      cep: originCep,
      logradouro: undefined,
      numero: undefined,
      complemento: undefined,
      bairro: undefined,
      cidade: originCidade,
      uf: originUf,
    };

    const queue = getQueue<ShipmentCreateJobPayload>(QUEUE_NAMES.SHIPMENT_CREATE);
    await queue.add(
      'create',
      {
        shipmentId: result.shipmentId,
        userId,
        carrier,
        service,
        declaredValue,
        targetStatus: initialStatus, // Status após integração (PICKUP_REQUESTED ou AWAITING_DROP_OFF_AT_POINT)
        externalServiceId: input.externalServiceId,
        originAddress: {
          cep: originAddr.cep || originCep,
          logradouro: originAddr.logradouro,
          numero: originAddr.numero,
          complemento: originAddr.complemento,
          bairro: originAddr.bairro,
          cidade: originAddr.cidade || originCidade,
          uf: originAddr.uf || originUf,
        },
      },
      {
        priority: JOB_PRIORITY.HIGH,
        jobId: `shipment-create-${result.shipmentId}`,
      }
    );

    logger.info({
      event: 'shipment_create_job_enqueued',
      shipmentId: result.shipmentId,
      carrier,
    }, 'Carrier integration job enqueued');
  }

  logger.info({
    event: 'create_paid_shipment_success',
    trackingCode,
    shipmentId: result.shipmentId,
    isIdempotent: result.isIdempotent,
  }, 'Paid shipment creation completed');

  return result;
}

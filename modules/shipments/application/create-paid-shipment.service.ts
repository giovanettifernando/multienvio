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

import { Prisma, Package } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { createShipmentWithVolumes } from '@/modules/shipments/application/create-with-volumes';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { integrateWithCarrier } from '@/modules/shipments/application/carrier-integration';
import { sendShipmentTrackingEmail } from '@/platform/email/mailer';
import { logger } from '@/platform/logging/logger';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import type { ShipmentCreateJobPayload } from '@/platform/queue/types';
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
import { isCorreiosCarrier } from '@/shared/utils/carrier';

// ============================================================================
// TIPOS
// ============================================================================

export type PaymentMethod = 'WALLET' | 'MERCADO_PAGO';

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
  // Dados específicos para pagamento MercadoPago
  mercadoPagoPaymentId?: string;
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
    mercadoPagoPaymentId,
    pickupFee,
  } = input;

  const declaredValue = calculateDeclaredValue(document, insuranceValue);
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
    }

    // 3) CRIAR SHIPMENT com status PROCESSING (integração com transportadora é assíncrona)
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
        document: {
          ...documentData as object,
          payment: {
            status: 'approved',
            method: paymentMethod.toLowerCase(),
            confirmedAt: new Date().toISOString(),
            ...(walletTransactionId && { walletTransactionId }),
            ...(mercadoPagoPaymentId && { mercadoPagoPaymentId }),
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

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Monta dados de remetente e destinatário para integração com transportadora
 */
async function buildCarrierIntegrationData(
  tx: Prisma.TransactionClient,
  input: CreatePaidShipmentInput
) {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: {
      name: true,
      razaoSocial: true,
      email: true,
      phone: true,
      cpf: true,
      cnpj: true,
    },
  });

  const originData = input.originAddress || {
    cep: input.originCep,
    cidade: input.originCidade,
    uf: input.originUf,
  };

  const senderDocumento =
    (user?.cnpj && user.cnpj.trim() !== '' ? user.cnpj : null) ||
    user?.cpf ||
    '';

  const senderData = {
    nome: user?.razaoSocial || user?.name || 'Remetente',
    documento: senderDocumento.replace(/\D/g, ''),
    telefone: user?.phone || undefined,
    email: user?.email || undefined,
    cep: (originData.cep || input.originCep).replace(/\D/g, ''),
    logradouro: originData.logradouro || undefined,
    numero: originData.numero || undefined,
    complemento: originData.complemento || undefined,
    bairro: originData.bairro || undefined,
    cidade: originData.cidade || input.originCidade || undefined,
    uf: originData.uf || input.originUf || undefined,
  };

  const recipientData = {
    nome: input.recipient.nome,
    documento: input.recipient.documento || undefined,
    telefone: input.recipient.telefone || undefined,
    email: input.recipient.email || undefined,
    cep: input.recipient.cep.replace(/\D/g, ''),
    logradouro: input.recipient.logradouro || '',
    numero: input.recipient.numero || undefined,
    complemento: input.recipient.complemento || undefined,
    bairro: input.recipient.bairro || undefined,
    cidade: input.recipient.cidade,
    uf: input.recipient.uf,
  };

  return { senderData, recipientData };
}

/**
 * Integra com a transportadora de forma OBRIGATÓRIA para Correios.
 * Para outras transportadoras, a integração é best-effort.
 *
 * CORREIOS: Se a pré-postagem falhar, lança erro e a transação é revertida.
 * Shipments Correios sem pré-postagem são inúteis porque:
 * - Não têm código de rastreio real dos Correios
 * - Não têm etiqueta para imprimir
 * - O pacote não pode ser postado
 *
 * OUTRAS TRANSPORTADORAS: Integração best-effort (logs warning, não bloqueia)
 */
async function integrateWithCarrierRequired(
  tx: Prisma.TransactionClient,
  input: CreatePaidShipmentInput,
  shipmentId: string,
  packages: Package[],
  declaredValue: number
): Promise<void> {
  const { senderData, recipientData } = await buildCarrierIntegrationData(tx, input);
  const isCorreios = isCorreiosCarrier(input.carrier);

  const integrationResult = await integrateWithCarrier(tx, {
    shipmentId,
    carrier: input.carrier,
    serviceName: input.service,
    serviceCode: undefined,
    packages,
    sender: senderData,
    recipient: recipientData,
    declaredValue,
    contentDescription: 'Mercadorias diversas',
  });

  if (!integrationResult.success) {
    if (isCorreios) {
      // CORREIOS: Integração é OBRIGATÓRIA
      logger.error({
        event: 'correios_integration_failed_required',
        shipmentId,
        carrier: input.carrier,
        errorMessage: integrationResult.errorMessage,
        errors: integrationResult.errors,
      }, 'Correios integration failed - transaction will be rolled back');

      // Lançar erro para reverter a transação
      throw Object.assign(
        new Error(
          integrationResult.errorMessage ||
          'Não foi possível gerar a pré-postagem nos Correios. Por favor, tente novamente.'
        ),
        { code: 'CARRIER_INTEGRATION_FAILED' }
      );
    } else {
      // OUTRAS TRANSPORTADORAS: Best-effort (não bloqueia)
      logger.warn({
        event: 'carrier_integration_failed_non_blocking',
        shipmentId,
        carrier: input.carrier,
        errorMessage: integrationResult.errorMessage,
      }, 'Carrier integration failed (non-blocking for non-Correios)');
    }
    return;
  }

  logger.info({
    event: 'carrier_integration_success',
    shipmentId,
    carrier: input.carrier,
    primaryTrackingCode: integrationResult.primaryTrackingCode,
  }, 'Carrier integration successful');
}

/**
 * @deprecated Use integrateWithCarrierRequired instead.
 * Integra com a transportadora de forma segura (não bloqueia em caso de erro)
 * AVISO: Esta função permite criar shipments sem pré-postagem válida!
 */
async function integrateWithCarrierSafely(
  tx: Prisma.TransactionClient,
  input: CreatePaidShipmentInput,
  shipmentId: string,
  packages: Package[],
  declaredValue: number
): Promise<void> {
  try {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        name: true,
        razaoSocial: true,
        email: true,
        phone: true,
        cpf: true,
        cnpj: true,
      },
    });

    const originData = input.originAddress || {
      cep: input.originCep,
      cidade: input.originCidade,
      uf: input.originUf,
    };

    const senderDocumento =
      (user?.cnpj && user.cnpj.trim() !== '' ? user.cnpj : null) ||
      user?.cpf ||
      '';

    const senderData = {
      nome: user?.razaoSocial || user?.name || 'Remetente',
      documento: senderDocumento.replace(/\D/g, ''),
      telefone: user?.phone || undefined,
      email: user?.email || undefined,
      cep: (originData.cep || input.originCep).replace(/\D/g, ''),
      logradouro: originData.logradouro || undefined,
      numero: originData.numero || undefined,
      complemento: originData.complemento || undefined,
      bairro: originData.bairro || undefined,
      cidade: originData.cidade || input.originCidade || undefined,
      uf: originData.uf || input.originUf || undefined,
    };

    const recipientData = {
      nome: input.recipient.nome,
      documento: input.recipient.documento || undefined,
      telefone: input.recipient.telefone || undefined,
      email: input.recipient.email || undefined,
      cep: input.recipient.cep.replace(/\D/g, ''),
      logradouro: input.recipient.logradouro || '',
      numero: input.recipient.numero || undefined,
      complemento: input.recipient.complemento || undefined,
      bairro: input.recipient.bairro || undefined,
      cidade: input.recipient.cidade,
      uf: input.recipient.uf,
    };

    const integrationResult = await integrateWithCarrier(tx, {
      shipmentId,
      carrier: input.carrier,
      serviceName: input.service,
      serviceCode: undefined,
      packages,
      sender: senderData,
      recipient: recipientData,
      declaredValue,
      contentDescription: 'Mercadorias diversas',
    });

    if (integrationResult.success) {
      logger.info({
        event: 'carrier_integration_success',
        shipmentId,
        carrier: input.carrier,
        primaryTrackingCode: integrationResult.primaryTrackingCode,
      }, 'Carrier integration successful');
    } else {
      logger.warn({
        event: 'carrier_integration_failed',
        shipmentId,
        carrier: input.carrier,
        errorMessage: integrationResult.errorMessage,
      }, 'Carrier integration failed (non-blocking)');
    }
  } catch (integrationError) {
    logger.error({
      event: 'carrier_integration_error',
      shipmentId,
      carrier: input.carrier,
      err: integrationError,
    }, 'Carrier integration error (non-blocking)');
  }
}

/**
 * Envia email de rastreamento de forma assíncrona
 */
async function sendTrackingEmailAsync(
  userId: string,
  recipientEmail: string,
  recipientName: string,
  trackingCode: string,
  destinationCity: string,
  destinationState: string
): Promise<void> {
  try {
    // Buscar nome do remetente
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, razaoSocial: true },
    });
    const senderName = sender?.razaoSocial || sender?.name || 'Remetente';

    const sent = await sendShipmentTrackingEmail(
      recipientEmail,
      recipientName,
      trackingCode,
      senderName,
      destinationCity,
      destinationState
    );

    if (sent) {
      logger.info({
        event: 'tracking_email_sent',
        trackingCode,
        recipientEmail,
      }, 'Tracking email sent to recipient');
    } else {
      logger.warn({
        event: 'tracking_email_failed',
        trackingCode,
        recipientEmail,
      }, 'Failed to send tracking email');
    }
  } catch (emailError) {
    logger.error({
      event: 'tracking_email_error',
      trackingCode,
      err: emailError,
    }, 'Error sending tracking email');
  }
}

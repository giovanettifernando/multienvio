/**
 * Recipient Payment Service
 *
 * Gerencia o fluxo de "Frete pago pelo destinatário":
 * 1. Remetente cria um RecipientPaymentRequest
 * 2. Destinatário recebe link de pagamento por e-mail
 * 3. Após pagamento, Shipment real é criado
 */

import { Prisma, RecipientPaymentStatus } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { createShipmentWithVolumes } from '@/modules/shipments/application/create-with-volumes';
import { calculateCommissionsInCents, calculateInsuranceCommission, resolveCarrierSlugByName } from '@/modules/quotes/application/commission';
// Eventos de rastreamento virão dos Correios via webhook/sync
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { integrateWithCarrier } from '@/modules/shipments/application/carrier-integration';
import { generatePlatformTrackingCode } from '@/modules/cart/application/checkout.service';
import { logger } from '@/platform/logging/logger';
import { canReleaseService } from '@/platform/integrations/asaas/release';
import {
  type CreateRecipientPaymentInput,
  type RecipientPaymentRequestWithPackages,
  type PublicPaymentData,
  type ProcessPaymentResult,
  type ListRequestsFilters,
  type ListRequestsResult,
  calculateExpirationDate,
} from './types';

// ============================================================================
// CREATE REQUEST
// ============================================================================

/**
 * Cria um novo RecipientPaymentRequest
 * O shipment só será criado após o pagamento pelo destinatário
 */
export async function createRecipientPaymentRequest(
  input: CreateRecipientPaymentInput
): Promise<RecipientPaymentRequestWithPackages> {
  const expiresAt = calculateExpirationDate();

  logger.info({
    event: 'recipient_payment_request_start',
    senderId: input.senderId,
    recipientEmail: input.recipient.email,
    totalCents: input.quote.totalCents,
  }, 'Creating recipient payment request');

  const request = await prisma.recipientPaymentRequest.create({
    data: {
      // Remetente
      senderId: input.senderId,

      // Origem
      originAddressId: input.origin.addressId,
      originCep: input.origin.cep.replace(/\D/g, ''),
      originCity: input.origin.city,
      originState: input.origin.state,
      originAddress: input.origin.address,
      originNeighborhood: input.origin.neighborhood,
      originNumber: input.origin.number,
      originComplement: input.origin.complement,

      // Destinatário
      recipientName: input.recipient.name,
      recipientEmail: input.recipient.email.toLowerCase().trim(),
      recipientPhone: input.recipient.phone,
      recipientDocument: input.recipient.document,

      // Destino
      destinationCep: input.destination.cep.replace(/\D/g, ''),
      destinationCity: input.destination.city,
      destinationState: input.destination.state,
      destinationAddress: input.destination.address,
      destinationNeighborhood: input.destination.neighborhood,
      destinationNumber: input.destination.number,
      destinationComplement: input.destination.complement,

      // Totais
      totalWeight: input.totalWeight,
      declaredValue: input.declaredValue,

      // Cotação
      carrier: input.quote.carrier,
      service: input.quote.service,
      serviceCode: input.quote.serviceCode,
      estimatedDays: input.quote.estimatedDays,

      // Valores
      freightCostCents: input.quote.freightCostCents,
      pickupFeeCents: input.quote.pickupFeeCents,
      totalCents: input.quote.totalCents,
      shippingCommissionCents: input.quote.shippingCommissionCents,
      pickupCommissionCents: input.quote.pickupCommissionCents,

      // Opções
      pickupAtOrigin: input.pickupAtOrigin ?? false,
      document: input.document as Prisma.InputJsonValue,

      // Expiração
      expiresAt,

      // Volumes
      packages: {
        create: input.packages.map((pkg) => ({
          packageNumber: pkg.packageNumber,
          width: pkg.width,
          height: pkg.height,
          length: pkg.length,
          weight: pkg.weight,
        })),
      },
    },
    include: {
      packages: true,
    },
  });

  logger.info({
    event: 'recipient_payment_request_created',
    requestId: request.id,
    paymentToken: request.paymentToken,
    expiresAt: request.expiresAt,
  }, 'Recipient payment request created successfully');

  return request;
}

// ============================================================================
// GET BY TOKEN (PUBLIC)
// ============================================================================

/**
 * Busca um request pelo token de pagamento
 * Retorna dados públicos para a página de pagamento
 */
export async function getRequestByToken(
  token: string
): Promise<PublicPaymentData | null> {
  const request = await prisma.recipientPaymentRequest.findUnique({
    where: { paymentToken: token },
    include: {
      sender: {
        select: {
          name: true,
          razaoSocial: true,
        },
      },
      packages: true,
    },
  });

  if (!request) {
    return null;
  }

  return {
    id: request.id,
    paymentToken: request.paymentToken,
    status: request.status,
    expiresAt: request.expiresAt,

    // Dados do remetente (apenas nome)
    senderName: request.sender.razaoSocial || request.sender.name,

    // Origem (apenas cidade/estado)
    originCity: request.originCity,
    originState: request.originState,

    // Destino
    destinationCity: request.destinationCity,
    destinationState: request.destinationState,

    // Destinatário
    recipientName: request.recipientName,
    recipientEmail: request.recipientEmail,

    // Valores
    totalCents: request.totalCents,
    freightCostCents: request.freightCostCents,
    pickupFeeCents: request.pickupFeeCents,

    // Transportadora
    carrier: request.carrier,
    service: request.service,
    estimatedDays: request.estimatedDays,

    // Volumes
    packagesCount: request.packages.length,
    totalWeight: request.totalWeight,
  };
}

// ============================================================================
// PROCESS PAYMENT
// ============================================================================

/**
 * Processa o pagamento pelo destinatário e cria o Shipment
 *
 * GATE DE LIBERAÇÃO (Task 12b): este endpoint é público — não há sessão de
 * usuário que garanta que quem está chamando é quem realmente pagou. O
 * `transactionId` (PaymentTransaction do Asaas criada por
 * app/api/recipient-payment/create-payment/route.ts) é o único jeito de
 * provar isso. Quatro checagens, na ordem:
 *   1) STATUS: canReleaseService(transaction.status) — PENDING (boleto
 *      recém-gerado, PIX ainda não pago) não libera nada; quem libera depois
 *      é o webhook/monitor.
 *   2) VÍNCULO: transaction.metadata.recipientPaymentRequestId precisa ser
 *      o id DESTE request — sem sessão de usuário, é o vínculo
 *      transação↔request que substitui a checagem de dono.
 *   3) VALOR: transaction.amountCents precisa cobrir request.totalCents.
 *   4) ANTI-REUSO: nem a transação (metadata.shipmentId) nem o request
 *      (status já PAID) podem ter liberado um shipment antes. O request é
 *      reivindicado com um UPDATE condicional (WHERE status = 'PENDING')
 *      logo após passar nas checagens acima — se outra requisição concorrente
 *      já venceu a corrida, count vem 0 e esta chamada é rejeitada antes de
 *      criar um segundo shipment.
 */
export async function processRecipientPayment(
  token: string,
  _paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BOLETO',
  transactionId: string
): Promise<ProcessPaymentResult> {
  logger.info({
    event: 'recipient_payment_process_start',
    token,
    transactionId,
  }, 'Processing recipient payment');

  const result = await prisma.$transaction(async (tx) => {
    // 1) Buscar request com lock
    const request = await tx.recipientPaymentRequest.findUnique({
      where: { paymentToken: token },
      include: {
        packages: true,
        sender: {
          select: {
            id: true,
            name: true,
            razaoSocial: true,
            email: true,
            phone: true,
            cpf: true,
            cnpj: true,
          },
        },
      },
    });

    if (!request) {
      return { success: false, error: 'Solicitação não encontrada' };
    }

    // 2) Validar status
    if (request.status === 'PAID') {
      return {
        success: true,
        shipmentId: request.shipmentId!,
        platformTrackingCode: undefined, // Já foi processado
      };
    }

    if (request.status === 'CANCELLED') {
      return { success: false, error: 'Esta solicitação foi cancelada' };
    }

    if (request.status === 'EXPIRED' || new Date() > request.expiresAt) {
      // Atualizar status se ainda não estava expirado
      if (request.status !== 'EXPIRED') {
        await tx.recipientPaymentRequest.update({
          where: { id: request.id },
          data: { status: 'EXPIRED' },
        });
      }
      return { success: false, error: 'Esta solicitação expirou' };
    }

    // 2b) GATE DE PAGAMENTO — ver docstring da função.
    const transaction = await tx.paymentTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return { success: false, error: 'Pagamento não encontrado' };
    }

    const transactionMeta = (transaction.metadata ?? {}) as Record<string, unknown>;

    if (transactionMeta.recipientPaymentRequestId !== request.id) {
      return { success: false, error: 'Pagamento não corresponde a esta solicitação' };
    }

    if (transactionMeta.shipmentId) {
      return { success: false, error: 'Este pagamento já foi utilizado para criar outro envio' };
    }

    if (!canReleaseService(transaction.status)) {
      return {
        success: false,
        error: 'Pagamento aguardando confirmação. Assim que for confirmado, seu envio será liberado automaticamente.',
      };
    }

    if (transaction.amountCents < request.totalCents) {
      return { success: false, error: 'Valor do pagamento não corresponde ao esperado' };
    }

    // 2c) CLAIM ATÔMICO do request: garante que duas chamadas concorrentes
    // (duplo clique, retry do frontend, dois tabs) não criem dois shipments
    // para o mesmo request. A condição WHERE status = 'PENDING' faz o
    // Postgres serializar as tentativas pela linha; quem chega depois vê
    // count 0 e sabe que a primeira já venceu — sem isso a checagem de
    // status acima (feita por leitura simples, sem lock) não fecha a corrida.
    const claim = await tx.recipientPaymentRequest.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date() },
    });

    if (claim.count === 0) {
      return { success: false, error: 'Esta solicitação já foi processada' };
    }

    // 3) Gerar código de rastreamento único
    const trackingCode = generatePlatformTrackingCode();

    // 4) Determinar status inicial do shipment
    const initialStatus = request.pickupAtOrigin
      ? ShipmentStatus.PICKUP_REQUESTED
      : ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;

    // 5) Criar shipment
    // Comissoes: o frontend envia `shippingCommissionCents: undefined` ("calculado
    // no backend"), mas ninguem calculava — os envios pagos pelo destinatario
    // ficavam sem nenhuma comissao registrada. Calculamos aqui, na mesma conta
    // dos demais fluxos, caindo para o que veio no pedido quando existir.
    const carrierSlug = resolveCarrierSlugByName(request.carrier) ?? '';
    const { commissionAmount: insuranceCommission } = await calculateInsuranceCommission(
      request.declaredValue,
      carrierSlug
    );
    const insuranceCommissionCents = Math.round(insuranceCommission * 100);
    const { shippingCommissionCents, pickupCommissionCents } = await calculateCommissionsInCents(
      request.freightCostCents - insuranceCommissionCents,
      request.pickupFeeCents ?? 0,
      carrierSlug
    );

    const { shipment, packages } = await createShipmentWithVolumes(tx, {
      shipment: {
        platformTrackingCode: trackingCode,
        carrierTrackingCode: null,
        senderId: request.senderId,
        recipientName: request.recipientName,
        recipientPhone: request.recipientPhone,
        recipientEmail: request.recipientEmail,
        recipientDocument: request.recipientDocument,
        originCep: request.originCep,
        originAddress: [request.originAddress, request.originNumber, request.originComplement]
          .filter(Boolean).join(', ') || null,
        originNeighborhood: request.originNeighborhood,
        originCity: request.originCity,
        originState: request.originState,
        senderName: request.sender.razaoSocial || request.sender.name,
        destinationCep: request.destinationCep,
        destinationAddress: [
          request.destinationAddress,
          request.destinationNumber,
          request.destinationComplement,
        ].filter(Boolean).join(', ') || null,
        destinationNeighborhood: request.destinationNeighborhood,
        destinationCity: request.destinationCity,
        destinationState: request.destinationState,
        declaredValue: request.declaredValue,
        carrier: request.carrier,
        service: request.service,
        estimatedDays: request.estimatedDays ?? 0,
        freightCost: request.freightCostCents / 100,
        pickupPointId: null,
        document: request.document as object,
        status: initialStatus,
        paymentMethod: 'RECIPIENT_PAID',
        platformShippingCommissionCents:
          request.shippingCommissionCents ?? (shippingCommissionCents > 0 ? shippingCommissionCents : null),
        platformPickupCommissionCents:
          request.pickupCommissionCents ?? (pickupCommissionCents > 0 ? pickupCommissionCents : null),
        platformInsuranceCommissionCents: insuranceCommissionCents > 0 ? insuranceCommissionCents : null,
      },
      volumes: request.packages.map((pkg) => ({
        peso: pkg.weight,
        altura: pkg.height,
        largura: pkg.width,
        comprimento: pkg.length,
      })),
    });

    // 6) Marcar reserva como usada
    await tx.trackingCodeReservation.updateMany({
      where: {
        code: trackingCode,
        userId: request.senderId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
        shipmentId: shipment.id,
      },
    });

    // 7) Criar etiqueta
    await tx.label.create({
      data: {
        shipmentId: shipment.id,
        carrier: request.carrier,
        service: request.service,
        status: 'issued',
        priceCents: request.freightCostCents,
        currency: 'BRL',
        trackingCode,
        recipientName: request.recipientName,
        isPrinted: false,
      },
    });

    // 8) Criar pickup request se solicitado coleta
    if (request.pickupAtOrigin) {
      await tx.pickupRequest.create({
        data: {
          userId: request.senderId,
          shipmentId: shipment.id,
          originCep: request.originCep,
          originAddress: request.originAddress,
          originCity: request.originCity,
          originUf: request.originState,
          status: 'PENDING',
        },
      });
    }

    // 9) Eventos de rastreamento virão dos Correios via webhook/sync
    // Não criar evento inicial genérico - API pública tem fallback para timeline vazia

    // 10) Integrar com transportadora
    await integrateWithCarrierSafely(tx, request, shipment.id, packages);

    // 11) Gravar o shipmentId no request (status e paidAt já foram gravados
    // pelo claim atômico no passo 2c, antes de qualquer efeito colateral).
    await tx.recipientPaymentRequest.update({
      where: { id: request.id },
      data: { shipmentId: shipment.id },
    });

    // 11b) Marcar a PaymentTransaction como consumida (anti-reuso): grava o
    // shipmentId em metadata dentro da MESMA transação de banco que criou o
    // shipment, mesmo padrão usado em create-paid-shipment.service.ts e
    // create-cart-shipments-with-payment.service.ts.
    await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        metadata: {
          ...transactionMeta,
          shipmentId: shipment.id,
        } as Prisma.InputJsonValue,
      },
    });

    logger.info({
      event: 'recipient_payment_success',
      requestId: request.id,
      shipmentId: shipment.id,
      trackingCode,
      transactionId: transaction.id,
    }, 'Recipient payment processed successfully');

    return {
      success: true,
      shipmentId: shipment.id,
      platformTrackingCode: trackingCode,
      publicTrackingId: shipment.publicTrackingId,
    };
  });

  return result;
}

// ============================================================================
// CANCEL REQUEST
// ============================================================================

/**
 * Cancela um request (apenas pelo remetente e se ainda não foi pago)
 */
export async function cancelRecipientPaymentRequest(
  requestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const request = await prisma.recipientPaymentRequest.findFirst({
    where: {
      id: requestId,
      senderId: userId,
    },
  });

  if (!request) {
    return { success: false, error: 'Solicitação não encontrada' };
  }

  if (request.status !== 'PENDING') {
    return {
      success: false,
      error: `Não é possível cancelar uma solicitação com status "${request.status}"`,
    };
  }

  await prisma.recipientPaymentRequest.update({
    where: { id: requestId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  logger.info({
    event: 'recipient_payment_cancelled',
    requestId,
    userId,
  }, 'Recipient payment request cancelled');

  return { success: true };
}

// ============================================================================
// RESEND PAYMENT LINK
// ============================================================================

/**
 * Reenvia o link de pagamento e reseta o prazo de expiração
 */
export async function resendPaymentLink(
  requestId: string,
  userId: string
): Promise<{ success: boolean; newToken?: string; expiresAt?: Date; error?: string }> {
  const request = await prisma.recipientPaymentRequest.findFirst({
    where: {
      id: requestId,
      senderId: userId,
    },
  });

  if (!request) {
    return { success: false, error: 'Solicitação não encontrada' };
  }

  if (request.status !== 'PENDING') {
    return {
      success: false,
      error: `Não é possível reenviar link para solicitação com status "${request.status}"`,
    };
  }

  // Gerar novo token e resetar expiração
  const newExpiresAt = calculateExpirationDate();

  const updated = await prisma.recipientPaymentRequest.update({
    where: { id: requestId },
    data: {
      expiresAt: newExpiresAt,
      // Nota: O paymentToken permanece o mesmo para não invalidar links já enviados
      // Se quiser gerar novo token, descomentar:
      // paymentToken: cuid(),
    },
  });

  logger.info({
    event: 'recipient_payment_link_resent',
    requestId,
    userId,
    newExpiresAt,
  }, 'Payment link expiration reset');

  return {
    success: true,
    newToken: updated.paymentToken,
    expiresAt: newExpiresAt,
  };
}

// ============================================================================
// LIST BY USER
// ============================================================================

/**
 * Lista os requests de pagamento do remetente
 */
export async function listRecipientPaymentRequests(
  userId: string,
  filters: ListRequestsFilters = {}
): Promise<ListRequestsResult> {
  const { status, limit = 20, offset = 0 } = filters;

  const where: Prisma.RecipientPaymentRequestWhereInput = {
    senderId: userId,
    ...(status && { status }),
  };

  const [requests, total] = await Promise.all([
    prisma.recipientPaymentRequest.findMany({
      where,
      include: {
        packages: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.recipientPaymentRequest.count({ where }),
  ]);

  return {
    requests,
    total,
    hasMore: offset + requests.length < total,
  };
}

// ============================================================================
// EXPIRE PENDING REQUESTS (for CRON job)
// ============================================================================

/**
 * Expira requests pendentes que passaram do prazo
 * Retorna os requests que foram expirados (para envio de e-mails)
 * Usado pelo job de expiração
 */
export async function expirePendingRequests(): Promise<RecipientPaymentRequestWithPackages[]> {
  // 1. Buscar requests que precisam expirar
  const requestsToExpire = await prisma.recipientPaymentRequest.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    include: {
      packages: true,
    },
  });

  if (requestsToExpire.length === 0) {
    return [];
  }

  // 2. Marcar como expirados
  await prisma.recipientPaymentRequest.updateMany({
    where: {
      id: { in: requestsToExpire.map((r) => r.id) },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  logger.info({
    event: 'recipient_payments_expired',
    count: requestsToExpire.length,
  }, `Expired ${requestsToExpire.length} pending recipient payment requests`);

  return requestsToExpire;
}

/**
 * Busca requests que vão expirar nas próximas horas (para enviar lembrete)
 */
export async function getRequestsExpiringWithin(
  hours: number
): Promise<RecipientPaymentRequestWithPackages[]> {
  const now = new Date();
  const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return prisma.recipientPaymentRequest.findMany({
    where: {
      status: 'PENDING',
      expiresAt: {
        gt: now,
        lt: futureDate,
      },
    },
    include: {
      packages: true,
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Integra com a transportadora de forma segura (não bloqueia em caso de erro)
 */
async function integrateWithCarrierSafely(
  tx: Prisma.TransactionClient,
  request: RecipientPaymentRequestWithPackages & {
    sender: {
      id: string;
      name: string;
      razaoSocial: string | null;
      email: string;
      phone: string | null;
      cpf: string | null;
      cnpj: string | null;
    };
  },
  shipmentId: string,
  packages: Array<{ id: string; weight: number; width: number; height: number; length: number }>
): Promise<void> {
  try {
    const senderDocumento =
      (request.sender.cnpj && request.sender.cnpj.trim() !== '' ? request.sender.cnpj : null) ||
      request.sender.cpf ||
      '';

    const senderData = {
      nome: request.sender.razaoSocial || request.sender.name,
      documento: senderDocumento.replace(/\D/g, ''),
      telefone: request.sender.phone || undefined,
      email: request.sender.email,
      cep: request.originCep.replace(/\D/g, ''),
      logradouro: request.originAddress || undefined,
      numero: request.originNumber || undefined,
      complemento: request.originComplement || undefined,
      bairro: request.originNeighborhood || undefined,
      cidade: request.originCity,
      uf: request.originState,
    };

    const recipientData = {
      nome: request.recipientName,
      documento: request.recipientDocument || undefined,
      telefone: request.recipientPhone || undefined,
      email: request.recipientEmail,
      cep: request.destinationCep.replace(/\D/g, ''),
      logradouro: request.destinationAddress || '',
      numero: request.destinationNumber || undefined,
      complemento: request.destinationComplement || undefined,
      bairro: request.destinationNeighborhood || undefined,
      cidade: request.destinationCity,
      uf: request.destinationState,
    };

    const integrationResult = await integrateWithCarrier(tx, {
      shipmentId,
      carrier: request.carrier,
      serviceName: request.service,
      serviceCode: request.serviceCode || undefined,
      packages: packages.map((pkg) => ({
        ...pkg,
        shipmentId,
        packageNumber: 1,
        carrierTrackingCode: null,
        carrierPrePostageId: null,
        carrierQuotePrice: null,
        hasDivergence: false,
        divergenceType: null,
        divergenceNotes: null,
        divergenceWidth: null,
        divergenceHeight: null,
        divergenceLength: null,
        divergenceWeight: null,
        divergencePhotoUrl: null,
        divergenceRegisteredAt: null,
        divergenceRegisteredBy: null,
        checkedAt: null,
        checkedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      sender: senderData,
      recipient: recipientData,
      declaredValue: request.declaredValue,
      contentDescription: 'Mercadorias diversas',
    });

    if (integrationResult.success) {
      logger.info({
        event: 'carrier_integration_success',
        shipmentId,
        carrier: request.carrier,
      }, 'Carrier integration successful');
    } else {
      logger.warn({
        event: 'carrier_integration_failed',
        shipmentId,
        carrier: request.carrier,
        errorMessage: integrationResult.errorMessage,
      }, 'Carrier integration failed (non-blocking)');
    }
  } catch (integrationError) {
    logger.error({
      event: 'carrier_integration_error',
      shipmentId,
      carrier: request.carrier,
      err: integrationError,
    }, 'Carrier integration error (non-blocking)');
  }
}

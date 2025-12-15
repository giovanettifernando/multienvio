/**
 * POST /api/shipments/create-paid
 *
 * Cria um shipment SOMENTE após confirmação de pagamento.
 * Esta é a nova rota que substitui o fluxo antigo onde o shipment
 * era criado antes do pagamento.
 *
 * Fluxo:
 * 1. Frontend reserva código de rastreamento (ao entrar em /cotacoes/finalizar)
 * 2. Usuário confirma pagamento (carteira, PIX ou cartão)
 * 3. Frontend chama esta rota com os dados + código reservado + método de pagamento
 * 4. Backend cria shipment + debita carteira (se wallet) atomicamente
 * 5. Email é enviado ao destinatário
 */

import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { validateDocumentHasItems } from '@/lib/checkout';
import { createPaidShipment, PaymentMethod } from '@/lib/shipments/create-paid-shipment.service';
import { enforceRateLimitByIP, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { logger } from '@/lib/logger';

/**
 * Resposta da API
 */
interface CreatePaidShipmentResponse {
  shipmentId: string;
  trackingCode: string;
  publicTrackingId: string | null;
  trackingUrl: string;
  labelId: string;
  walletTransactionId: string | null;
  balance?: number;
  message: string;
}

// Schema de validação
const createPaidShipmentSchema = z.object({
  // Código de rastreamento reservado (obrigatório)
  trackingCode: z.string().min(1, 'Código de rastreamento é obrigatório'),

  // Método de pagamento
  paymentMethod: z.enum(['WALLET', 'MERCADO_PAGO']),

  // ID do pagamento MercadoPago (se aplicável)
  mercadoPagoPaymentId: z.string().optional(),

  // Dados do destinatário
  recipient: z.object({
    nome: z.string(),
    telefone: z.string().nullish(),
    email: z.string().nullish(),
    documento: z.string().nullish(),
    cep: z.string(),
    logradouro: z.string().nullish(),
    numero: z.string().nullish(),
    complemento: z.string().nullish(),
    bairro: z.string().nullish(),
    cidade: z.string(),
    uf: z.string(),
    observacoes: z.string().nullish(),
    salvarRecorrente: z.boolean().optional().default(false),
  }),

  // Documento fiscal
  document: z.object({
    type: z.enum(['NFE', 'DECLARACAO']),
    packages: z.array(z.object({
      chave: z.string(),
      xmlId: z.string().nullable().optional(),
      items: z.array(z.object({
        id: z.string(),
        sku: z.string().optional().nullable(),
        descricao: z.string(),
        ncm: z.string().optional().nullable(),
        cfop: z.string().optional().nullable(),
        quantidade: z.number(),
        pesoLiquido: z.number().optional().nullable(),
        valorUnitario: z.number(),
        valorTotal: z.number(),
      })),
      nfeData: z.unknown().optional(),
    })).optional(),
    nfeKeys: z.array(z.object({ chave: z.string() })).optional(),
    nfeItems: z.array(z.object({
      descricao: z.string(),
      valorUnitario: z.number(),
      valorTotal: z.number().optional(),
      quantidade: z.number(),
    })).optional(),
    declarationItems: z.array(z.object({
      descricao: z.string(),
      valorUnitario: z.number(),
      quantidade: z.number(),
    })).optional(),
    volumeDeclarations: z.array(z.object({
      volumeIndex: z.number(),
      items: z.array(z.object({
        id: z.string(),
        descricao: z.string(),
        valorUnitario: z.number(),
        quantidade: z.number(),
      })),
    })).optional(),
  }),

  // Volumes
  volumes: z.array(z.object({
    peso: z.number(),
    altura: z.number(),
    largura: z.number(),
    comprimento: z.number(),
  })),

  // Valores
  insuranceValue: z.number().optional(),
  freightCost: z.number(),
  totalCost: z.number(),

  // Coleta
  pickupPointId: z.string().optional().nullable(),
  solicitarColeta: z.boolean().optional().default(false),
  pickupFee: z.object({
    collectorId: z.string(),
    feeAmount: z.number(),
    distanceKm: z.number(),
  }).optional(),

  // Transportadora
  carrier: z.string(),
  service: z.string(),

  // Endereços
  originCep: z.string(),
  originCidade: z.string().optional(),
  originUf: z.string().optional(),
  originAddress: z.object({
    cep: z.string(),
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    uf: z.string().optional(),
    nome: z.string().optional(),
  }).optional(),
  destinationCep: z.string(),
  estimatedDays: z.number(),
});

export const POST = withApiHandler<CreatePaidShipmentResponse>(async ({ req }) => {
  // Rate limiting
  await enforceRateLimitByIP(req as NextRequest, 'checkout', RATE_LIMITS.CHECKOUT);

  // Autenticar usuário
  const session = await getUserSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autenticado', status: 401 });
  }

  // Parse e validar payload
  const body = await req.json();
  const parsed = createPaidShipmentSchema.safeParse(body);

  if (!parsed.success) {
    logger.debug({
      event: 'create_paid_shipment_validation_error',
      errors: parsed.error.flatten(),
    }, 'Validation failed');

    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;

  // Validar se há pelo menos 1 item no documento
  if (!validateDocumentHasItems(data.document)) {
    throw new ApiError({
      code: 'MISSING_DOCUMENT_ITEMS',
      message: 'Informe ao menos um item no documento do envio antes de continuar.',
      status: 400,
    });
  }

  logger.info({
    event: 'create_paid_shipment_request',
    trackingCode: data.trackingCode,
    paymentMethod: data.paymentMethod,
    userId: session.userId,
  }, 'Processing paid shipment creation');

  try {
    // Criar shipment com pagamento
    const result = await createPaidShipment({
      userId: session.userId,
      trackingCode: data.trackingCode,
      recipient: {
        nome: data.recipient.nome,
        telefone: data.recipient.telefone,
        email: data.recipient.email,
        documento: data.recipient.documento,
        cep: data.recipient.cep,
        logradouro: data.recipient.logradouro,
        numero: data.recipient.numero,
        complemento: data.recipient.complemento,
        bairro: data.recipient.bairro,
        cidade: data.recipient.cidade,
        uf: data.recipient.uf,
        observacoes: data.recipient.observacoes,
        salvarRecorrente: data.recipient.salvarRecorrente,
      },
      document: data.document,
      volumes: data.volumes,
      insuranceValue: data.insuranceValue,
      pickupPointId: data.pickupPointId,
      carrier: data.carrier,
      service: data.service,
      originCep: data.originCep,
      originCidade: data.originCidade,
      originUf: data.originUf,
      originAddress: data.originAddress,
      destinationCep: data.destinationCep,
      estimatedDays: data.estimatedDays,
      freightCost: data.freightCost,
      totalCost: data.totalCost,
      solicitarColeta: data.solicitarColeta,
      paymentMethod: data.paymentMethod as PaymentMethod,
      mercadoPagoPaymentId: data.mercadoPagoPaymentId,
      pickupFee: data.pickupFee,
    });

    logger.info({
      event: 'create_paid_shipment_success',
      trackingCode: result.trackingCode,
      shipmentId: result.shipmentId,
      isIdempotent: result.isIdempotent,
    }, 'Paid shipment created successfully');

    return {
      data: {
        shipmentId: result.shipmentId,
        trackingCode: result.trackingCode,
        publicTrackingId: result.publicTrackingId,
        trackingUrl: `/rastreio/${result.publicTrackingId || result.trackingCode}`,
        labelId: result.labelId,
        walletTransactionId: result.walletTransactionId,
        message: result.isIdempotent
          ? 'Envio já foi criado anteriormente.'
          : 'Envio criado com sucesso!',
      },
    };

  } catch (error) {
    // Tratar erros específicos
    if (error instanceof Error) {
      const errorCode = 'code' in error ? (error as { code: string }).code : null;

      if (errorCode === 'WALLET_NOT_FOUND') {
        throw new ApiError({
          code: 'wallet_not_found',
          message: 'Carteira não encontrada. Entre em contato com o suporte.',
          status: 400,
        });
      }

      if (errorCode === 'INSUFFICIENT_FUNDS') {
        throw new ApiError({
          code: 'insufficient_funds',
          message: 'Saldo insuficiente na carteira.',
          status: 400,
        });
      }

      if (errorCode === 'INVALID_TRACKING_CODE') {
        throw new ApiError({
          code: 'invalid_tracking_code',
          message: 'Código de rastreamento inválido, expirado ou não autorizado. Recarregue a página e tente novamente.',
          status: 400,
        });
      }
    }

    logger.error({
      event: 'create_paid_shipment_error',
      trackingCode: data.trackingCode,
      err: error,
    }, 'Failed to create paid shipment');

    throw new ApiError({
      code: 'SHIPMENT_CREATION_ERROR',
      message: 'Erro ao criar envio. Por favor, tente novamente.',
      status: 500,
    });
  }
});

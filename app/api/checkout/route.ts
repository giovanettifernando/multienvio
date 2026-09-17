import { NextRequest } from 'next/server';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { requireUser } from '@/platform/auth/require-session';
import {
  processCheckout,
  validateDocumentHasItems,
  type CheckoutInput,
} from '@/modules/cart/application';
import { enforceRateLimitByIP, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { withIdempotency } from '@/platform/api/idempotency';
import { logger } from '@/platform/logging/logger';

/**
 * Tipos de resposta do checkout - Union discriminada por 'source'
 */
type CheckoutResponse =
  | {
      shipmentId: string;
      trackingCode: string;
      paymentUrl: string;
      source: 'gateway';
    }
  | {
      shipmentId: string;
      trackingCode: string;
      publicTrackingId: string | null;
      trackingUrl: string;
      source: 'created';
      message: string;
    };

// Schema de validação do checkout
const checkoutSchema = z.object({
  quoteId: z.string(),
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
  document: z.object({
    type: z.enum(['NFE', 'DECLARACAO']),
    // Novo formato NFE: packages (NF por pacote com items)
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
      // Dados completos da NF-e para geração do espelho fiscal
      nfeData: z.unknown().optional(),
    })).optional(),
    // Formato legado NFE: nfeKeys + nfeItems separados
    nfeKeys: z.array(z.object({ chave: z.string() })).optional(),
    nfeItems: z.array(z.object({
      descricao: z.string(),
      valorUnitario: z.number(),
      valorTotal: z.number().optional(),
      quantidade: z.number(),
    })).optional(),
    // Formato legado DECLARACAO: declarationItems (lista única)
    declarationItems: z.array(z.object({
      descricao: z.string(),
      valorUnitario: z.number(),
      quantidade: z.number(),
    })).optional(),
    // Novo formato DECLARACAO: volumeDeclarations (por volume)
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
  volumes: z.array(z.object({
    peso: z.number(),
    altura: z.number(),
    largura: z.number(),
    comprimento: z.number(),
  })),
  insuranceValue: z.number().optional(),
  carrier: z.string(),
  service: z.string(),
  originCep: z.string(),
  originCidade: z.string().optional(),
  originUf: z.string().optional(),
  // Dados completos do endereço de origem para integração com transportadora
  originAddress: z.object({
    cep: z.string(),
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    uf: z.string().optional(),
    nome: z.string().optional(), // label/apelido do endereço
  }).optional(),
  destinationCep: z.string(),
  estimatedDays: z.number(),
  freightCost: z.number(),
  // pickupPointId e solicitarColeta saíram do contrato. O schema não é
  // strict, então clientes antigos que ainda mandem esses campos seguem
  // funcionando: eles são ignorados em vez de derrubar a chamada.
});

type CheckoutPayload = z.infer<typeof checkoutSchema>;

/**
 * POST /api/checkout
 * Cria envio (shipment) e registra transação financeira
 *
 * Fluxo:
 * 1. Autentica usuário
 * 2. Valida payload via Zod
 * 3. Valida documentos do envio
 * 4. Processa checkout via service (cria shipment, label, integra com transportadora)
 * 5. Retorna URL de pagamento ou dados do envio criado
 */
export const POST = withApiHandler<CheckoutResponse>(async ({ req }) => {
  // Rate limiting by IP - 10 req/min (CHECKOUT preset - more permissive to not block sales)
  await enforceRateLimitByIP(req as NextRequest, 'checkout', RATE_LIMITS.CHECKOUT);

  // Autenticar usuário
  const session = await requireUser(req);

  // Parse e validar payload
  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: CheckoutPayload = parsed.data;

  // Validar se há pelo menos 1 item no documento
  if (!validateDocumentHasItems(data.document)) {
    throw new ApiError({
      code: 'MISSING_DOCUMENT_ITEMS',
      message: 'Informe ao menos um item no documento do envio antes de continuar.',
      status: 400,
    });
  }

  // Preparar input para o service
  const checkoutInput: CheckoutInput = {
    userId: session.userId,
    quoteId: data.quoteId,
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
    carrier: data.carrier,
    service: data.service,
    originCep: data.originCep,
    originCidade: data.originCidade,
    originUf: data.originUf,
    originAddress: data.originAddress,
    destinationCep: data.destinationCep,
    estimatedDays: data.estimatedDays,
    freightCost: data.freightCost,
  };

  // SECURITY: Idempotência para prevenir checkouts duplicados
  // O cliente deve enviar um header X-Idempotency-Key único por checkout
  const idempotencyKey = req.headers.get('x-idempotency-key');

  // Processar checkout via service com idempotência
  const { result, fromCache } = await withIdempotency(
    idempotencyKey,
    () => processCheckout(checkoutInput),
    5 * 60 * 1000 // 5 minutos de cache
  );

  if (fromCache) {
    logger.info({
      event: 'checkout_idempotency_hit',
      idempotencyKey,
      shipmentId: result.shipmentId,
    }, 'Checkout returned from idempotency cache');
  }

  // Verificar se há integração de pagamento configurada
  const paymentGatewayEnabled = process.env.PAYMENT_GATEWAY_ENABLED === 'true';
  const paymentGatewayUrl = process.env.PAYMENT_GATEWAY_URL;

  if (paymentGatewayEnabled && paymentGatewayUrl) {
    return {
      data: {
        shipmentId: result.shipmentId,
        trackingCode: result.trackingCode,
        paymentUrl: `${paymentGatewayUrl}/pay/${result.shipmentId}`,
        source: 'gateway',
      },
    };
  }

  // Retornar info do envio criado
  // Nota: Pagamento não é mais processado aqui.
  // O modal de checkout irá chamar /api/wallet/debit para processar o pagamento.
  return {
    data: {
      shipmentId: result.shipmentId,
      trackingCode: result.trackingCode,
      publicTrackingId: result.publicTrackingId,
      trackingUrl: `/rastreio/${result.publicTrackingId}`,
      source: 'created',
      message: 'Envio criado. Aguardando confirmação de pagamento.',
    },
  };
});

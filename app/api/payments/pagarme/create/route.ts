/**
 * POST /api/payments/pagarme/create
 *
 * Cria um pagamento via Pagar.me
 * Suporta cartão de crédito e PIX
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { getSession } from '@/modules/auth/application/session';
import { createPagarmePaymentWithTracking } from '@/platform/integrations/pagarme';
import { prisma } from '@/platform/db/db';

/**
 * Schema de validação para criação de pagamento
 */
const createPaymentSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().min(1),
  paymentMethod: z.enum(['credit_card', 'pix']),
  cardToken: z.string().optional(),
  cardId: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional(),
  pixExpiresIn: z.number().int().min(300).max(86400).optional(),
  metadata: z.object({
    type: z.enum(['wallet_topup', 'checkout_payment']),
    shipmentId: z.string().optional(),
    shipmentIds: z.array(z.string()).optional(),
  }),
});

type PaymentResponse = {
  transactionId: string;
  orderId: string;
  status: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
};

/**
 * POST - Cria um pagamento
 */
export const POST = withApiHandler<PaymentResponse>(async (context) => {
  // Autenticação
  const session = await getSession();
  if (!session) {
    throw ApiError.unauthorized('Não autenticado');
  }

  // Validar payload
  const body = await context.req.json();
  const parsed = createPaymentSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados inválidos', parsed.error.flatten());
  }

  const data = parsed.data;

  // Buscar dados do usuário
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, cpf: true, phone: true },
  });

  // Construir metadata — a API exige Record<string, string>, então serializamos arrays como JSON
  const metadata: Record<string, string> & { type: 'wallet_topup' | 'checkout_payment' } = {
    type: data.metadata.type,
    userId: session.userId,
  };
  if (data.metadata.shipmentId) metadata['shipmentId'] = data.metadata.shipmentId;
  if (data.metadata.shipmentIds) metadata['shipmentIds'] = JSON.stringify(data.metadata.shipmentIds);

  // Criar pagamento com rastreamento
  const result = await createPagarmePaymentWithTracking({
    userId: session.userId,
    userName: user.name,
    userEmail: user.email,
    userDocument: user.cpf?.replace(/\D/g, '') || undefined,
    userPhone: user.phone || undefined,
    amountCents: data.amountCents,
    description: data.description,
    referenceId: `pm_${Date.now()}`,
    paymentMethod: data.paymentMethod,
    cardToken: data.cardToken,
    cardId: data.cardId,
    installments: data.installments,
    pixExpiresIn: data.pixExpiresIn,
    metadata,
  });

  // Se pagamento falhou, retornar erro
  if (result.status === 'FAILED') {
    throw ApiError.badRequest('Pagamento recusado pela operadora', {
      status: result.status,
    });
  }

  return {
    data: {
      transactionId: result.transaction.id,
      orderId: result.orderId,
      status: result.status,
      pixQrCode: result.pixQrCode,
      pixQrCodeUrl: result.pixQrCodeUrl,
    },
    status: 201,
  };
});

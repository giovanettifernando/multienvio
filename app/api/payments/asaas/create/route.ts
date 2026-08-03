/**
 * POST /api/payments/asaas/create
 *
 * Cria uma cobrança no Asaas. Suporta PIX, cartão de crédito e boleto.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { getSession } from '@/modules/auth/application/session';
import { createAsaasPaymentWithTracking } from '@/platform/integrations/asaas';
import { buildDueDate } from '@/platform/integrations/asaas/due-date';
import { prisma } from '@/platform/db/db';

const createPaymentSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().min(1),
  paymentMethod: z.enum(['credit_card', 'pix', 'boleto']),
  cardToken: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional(),
  boletoDueDays: z.number().int().min(1).max(30).optional(),
  metadata: z.object({
    type: z.enum(['wallet_topup', 'checkout_payment']),
    shipmentId: z.string().optional(),
    shipmentIds: z.array(z.string()).optional(),
  }),
});

type PaymentResponse = {
  transactionId: string;
  chargeId: string;
  status: string;
  pixQrCode?: string;
  pixQrCodeImage?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  invoiceUrl?: string;
};

export const POST = withApiHandler<PaymentResponse>(async (context) => {
  const session = await getSession();
  if (!session) throw ApiError.unauthorized('Não autenticado');

  const parsed = createPaymentSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    throw ApiError.validation('Dados inválidos', parsed.error.flatten());
  }
  const data = parsed.data;

  const remoteIp = context.req.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (data.paymentMethod === 'credit_card' && !remoteIp) {
    throw ApiError.badRequest('Não foi possível identificar o IP de origem');
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, cpf: true, phone: true },
  });

  const metadata: Record<string, string> & { type: 'wallet_topup' | 'checkout_payment' } = {
    type: data.metadata.type,
    userId: session.userId,
  };
  if (data.metadata.shipmentId) metadata.shipmentId = data.metadata.shipmentId;
  if (data.metadata.shipmentIds) metadata.shipmentIds = JSON.stringify(data.metadata.shipmentIds);

  const result = await createAsaasPaymentWithTracking({
    userId: session.userId,
    userName: user.name,
    userEmail: user.email,
    userDocument: user.cpf?.replace(/\D/g, '') || undefined,
    userPhone: user.phone || undefined,
    amountCents: data.amountCents,
    description: data.description,
    dueDate: buildDueDate(data.paymentMethod, data.boletoDueDays),
    paymentMethod: data.paymentMethod,
    cardToken: data.cardToken,
    remoteIp,
    installments: data.installments,
    metadata,
  });

  if (result.status === 'FAILED') {
    throw ApiError.badRequest('Pagamento recusado pela operadora', { status: result.status });
  }

  return {
    data: {
      transactionId: result.transaction.id,
      chargeId: result.chargeId,
      status: result.status,
      pixQrCode: result.pixQrCode,
      pixQrCodeImage: result.pixQrCodeImage,
      boletoUrl: result.boletoUrl,
      boletoBarcode: result.boletoBarcode,
      invoiceUrl: result.invoiceUrl,
    },
    status: 201,
  };
});

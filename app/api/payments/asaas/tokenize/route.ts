/**
 * POST /api/payments/asaas/tokenize
 *
 * Tokeniza um cartão no Asaas. Roda no servidor — não há chamada do navegador
 * à API do gateway, então não existe restrição de CORS.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { getSession } from '@/modules/auth/application/session';
import { tokenizeCard, getOrCreateCustomer } from '@/platform/integrations/asaas';
import { prisma } from '@/platform/db/db';
import { Prisma } from '@prisma/client';

const tokenizeSchema = z.object({
  number: z.string().min(13),
  holderName: z.string().min(1),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(2024).max(2099),
  ccv: z.string().min(3).max(4),
  postalCode: z.string().min(8),
  addressNumber: z.string().min(1),
});

type TokenizeResponse = { token: string; brand: string; last4: string };

export const POST = withApiHandler<TokenizeResponse>(async (context) => {
  const session = await getSession();
  if (!session) throw ApiError.unauthorized('Não autenticado');

  const parsed = tokenizeSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    throw ApiError.validation('Dados do cartão inválidos', parsed.error.flatten());
  }
  const data = parsed.data;

  const remoteIp = context.req.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (!remoteIp) throw ApiError.badRequest('Não foi possível identificar o IP de origem');

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, cpf: true, phone: true, asaasCustomerId: true },
  });

  if (!user.cpf) throw ApiError.badRequest('Cadastre seu CPF antes de salvar um cartão');

  let customerId = user.asaasCustomerId;
  if (!customerId) {
    const customer = await getOrCreateCustomer({
      name: user.name,
      email: user.email,
      document: user.cpf,
      phone: user.phone || undefined,
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { asaasCustomerId: customerId } as Prisma.UserUpdateInput,
    });
  }

  const result = await tokenizeCard({
    customerId,
    holderName: data.holderName,
    number: data.number,
    expiryMonth: data.expMonth,
    expiryYear: data.expYear,
    ccv: data.ccv,
    remoteIp,
    holder: {
      name: user.name,
      email: user.email,
      cpfCnpj: user.cpf,
      postalCode: data.postalCode,
      addressNumber: data.addressNumber,
      phone: user.phone || '',
    },
  });

  return {
    data: {
      token: result.creditCardToken,
      brand: result.creditCardBrand,
      last4: result.creditCardNumber,
    },
  };
});

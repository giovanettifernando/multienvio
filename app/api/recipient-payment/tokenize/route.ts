/**
 * POST /api/recipient-payment/tokenize
 *
 * Tokeniza um cartão no Asaas para pagamento de frete por destinatário.
 * Rota PÚBLICA — valida pelo paymentToken do link do destinatário.
 * O token gerado é escopo do cliente Asaas da solicitação (sender),
 * não de usuário logado, então não há risco de tokenizar contra conta errada.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { prisma } from '@/platform/db/db';
import { tokenizeCard, getOrCreateCustomer } from '@/platform/integrations/asaas';
import { enforceRateLimit } from '@/platform/api/rate-limit';

const tokenizeSchema = z.object({
  paymentToken: z.string().min(1, 'Token de pagamento é obrigatório'),
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
  // Validar payload
  const body = await context.req.json();
  const parsed = tokenizeSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados do cartão inválidos', parsed.error.flatten());
  }

  const { paymentToken, number, holderName, expMonth, expYear, ccv, postalCode, addressNumber } = parsed.data;

  // Rate limit por IP — máximo 10 requisições por minuto por IP
  const remoteIp = context.req.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (!remoteIp) {
    throw ApiError.badRequest('Não foi possível identificar o IP de origem');
  }

  enforceRateLimit({
    key: `recipient-payment-tokenize:${remoteIp}`,
    limit: 10,
    windowMs: 60 * 1000, // 1 minuto
  });

  // Buscar a solicitação de pagamento pelo token
  const request = await prisma.recipientPaymentRequest.findUnique({
    where: { paymentToken },
    select: {
      id: true,
      senderId: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!request) {
    throw ApiError.notFound('Solicitação de pagamento não encontrada');
  }

  // Verificar status
  if (request.status === 'PAID') {
    throw ApiError.badRequest('Esta solicitação já foi paga');
  }

  if (request.status === 'CANCELLED') {
    throw ApiError.badRequest('Esta solicitação foi cancelada');
  }

  if (request.status === 'EXPIRED' || new Date() > request.expiresAt) {
    throw ApiError.badRequest('Esta solicitação expirou');
  }

  // Buscar dados do remetente (dono da solicitação)
  const sender = await prisma.user.findUniqueOrThrow({
    where: { id: request.senderId },
    select: { id: true, name: true, email: true, cpf: true, phone: true, asaasCustomerId: true },
  });

  if (!sender.cpf) {
    throw ApiError.badRequest('O remetente não possui CPF cadastrado');
  }

  // Obter ou criar cliente no Asaas para o remetente
  let customerId = sender.asaasCustomerId;
  if (!customerId) {
    const customer = await getOrCreateCustomer({
      name: sender.name,
      email: sender.email,
      document: sender.cpf,
      phone: sender.phone || undefined,
    });
    customerId = customer.id;
    // Não atualizar o usuário aqui — deixar isso para a rota de criação de pagamento
    // para evitar race conditions em solicitações simultâneas
  }

  // Tokenizar o cartão
  const result = await tokenizeCard({
    customerId,
    holderName,
    number,
    expiryMonth: expMonth,
    expiryYear: expYear,
    ccv,
    remoteIp,
    holder: {
      name: sender.name,
      email: sender.email,
      cpfCnpj: sender.cpf,
      postalCode,
      addressNumber,
      phone: sender.phone || '',
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

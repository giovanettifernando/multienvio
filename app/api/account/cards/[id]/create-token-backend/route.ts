/**
 * POST /api/account/cards/[id]/create-token-backend
 *
 * Cria um token de cartão usando o SDK backend do Mercado Pago.
 * Aceita CVV e CPF do usuário no body da requisição.
 *
 * Este endpoint usa o SDK backend que sabemos que funciona,
 * evitando problemas de incompatibilidade com o SDK JavaScript.
 */

import { ApiError } from "@/platform/api/errors";
import { withApiHandler } from "@/platform/api/handler";
import { requireUserId } from "../../helpers";
import { prisma } from "@/platform/db/db";
import { decryptPan, loadVaultKey, parsePanCipher } from "@/platform/crypto/card-vault";
import { createCardToken } from "@/platform/integrations/mercadopago/client";
import { z } from "zod";

const CreateTokenBackendSchema = z.object({
  cvv: z.string()
    .min(3, 'CVV deve ter no mínimo 3 dígitos')
    .max(4, 'CVV deve ter no máximo 4 dígitos')
    .regex(/^\d+$/, 'CVV deve conter apenas números'),
  cpf: z.string()
    .min(11, 'CPF deve ter no mínimo 11 caracteres')
    .max(14, 'CPF inválido'),
});

type CreateTokenBackendResponse = {
  id: string;
  first_six_digits: string;
  last_four_digits: string;
};

export const POST = withApiHandler<CreateTokenBackendResponse>(async (context) => {
  const { req, params, logger } = context;
  const { id: cardId } = await params;
  const userId = await requireUserId(req);

  // Validar entrada
  const body = await req.json();
  const parsed = CreateTokenBackendSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const { cvv, cpf } = parsed.data;

  // Buscar cartão
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      userId: true,
      brand: true,
      holderName: true,
      expMonth: true,
      expYear: true,
      last4: true,
      panCipher: true,
    },
  });

  if (!card) {
    throw new ApiError({
      code: "not_found",
      message: "Cartão não encontrado.",
      status: 404,
    });
  }

  // Verificar permissão
  if (card.userId !== userId) {
    throw new ApiError({
      code: "forbidden",
      message: "Você não tem permissão para acessar este cartão.",
      status: 403,
    });
  }

  if (!card.panCipher) {
    throw new ApiError({
      code: "not_found",
      message: "Cartão não possui PAN criptografado.",
      status: 404,
    });
  }

  // Validar CVV de acordo com a bandeira do cartão
  const isAmex = card.brand?.toLowerCase() === "amex" || card.brand?.toLowerCase() === "american express";
  const expectedCvvLength = isAmex ? 4 : 3;

  if (cvv.length !== expectedCvvLength) {
    throw new ApiError({
      code: "bad_request",
      message: `CVV inválido para ${card.brand || "este cartão"}. Esperado ${expectedCvvLength} dígitos.`,
      status: 400,
    });
  }

  // Audit log
  logger.info("account.card.create_token_backend", {
    userId,
    cardId,
    brand: card.brand,
    last4: card.last4,
  });

  // Descriptografar PAN
  const cipher = parsePanCipher(card.panCipher);
  if (!cipher) {
    throw ApiError.badRequest("Dados do cartão inválidos");
  }
  const key = loadVaultKey();
  if (!key) {
    throw ApiError.badRequest("Chave de criptografia não configurada");
  }
  const pan = decryptPan(cipher, key);

  // Debug: mostrar dados do cartão (mascarado)
  const cardData = {
    cardNumber: pan,
    cardholderName: card.holderName,
    expirationMonth: String(card.expMonth).padStart(2, "0"),
    expirationYear: String(card.expYear),
    securityCode: cvv,
    identificationType: "CPF",
    identificationNumber: cpf.replace(/\D/g, ""),
  };

  logger.debug('create_token_backend_card_data', {
    cardNumber: pan.substring(0, 6) + '****' + pan.substring(pan.length - 4),
    cardNumberLength: pan.length,
    cardholderName: card.holderName,
    expirationMonth: cardData.expirationMonth,
    expirationYear: cardData.expirationYear,
    securityCodeLength: cvv.length,
    identificationNumber: cardData.identificationNumber,
  });

  // Criar token usando SDK backend
  const token = await createCardToken(cardData);
  logger.info('create_token_backend_success', { tokenId: token.id });

  // Retornar token criado
  return {
    data: {
      id: token.id,
      first_six_digits: token.first_six_digits,
      last_four_digits: token.last_four_digits,
    },
    meta: {
      tags: ["account", "cards", "token", "backend"],
    },
  };
});

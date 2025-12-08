/**
 * POST /api/account/cards/[id]/create-token-backend
 *
 * Cria um token de cartão usando o SDK backend do Mercado Pago.
 * Aceita CVV e CPF do usuário no body da requisição.
 *
 * Este endpoint usa o SDK backend que sabemos que funciona,
 * evitando problemas de incompatibilidade com o SDK JavaScript.
 */

import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { requireUserId } from "../../helpers";
import { prisma } from "@/lib/db";
import { decryptPan, loadVaultKey, parsePanCipher } from "@/lib/crypto/card-vault";
import { createCardToken } from "@/lib/mercadopago/client";


export const POST = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const { id: cardId } = await params;
  const userId = await requireUserId(req);

  // Extrair CVV e CPF do body
  const body = await req.json();
  const cvv = body.cvv as string | undefined;
  const cpf = body.cpf as string | undefined;

  // Validação robusta de CVV
  if (!cvv) {
    throw new ApiError({
      code: "bad_request",
      message: "CVV é obrigatório.",
      status: 400,
    });
  }

  // CVV deve conter apenas dígitos
  if (!/^\d+$/.test(cvv)) {
    throw new ApiError({
      code: "bad_request",
      message: "CVV deve conter apenas números.",
      status: 400,
    });
  }

  // CVV deve ter 3 ou 4 dígitos (AMEX usa 4, outros usam 3)
  if (cvv.length < 3 || cvv.length > 4) {
    throw new ApiError({
      code: "bad_request",
      message: "CVV deve ter 3 ou 4 dígitos.",
      status: 400,
    });
  }

  if (!cpf || cpf.length < 11) {
    throw new ApiError({
      code: "bad_request",
      message: "CPF é obrigatório.",
      status: 400,
    });
  }

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

  console.log('[CREATE_TOKEN_BACKEND] Card data:', {
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
  console.log('[CREATE_TOKEN_BACKEND] Token criado:', token.id);

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

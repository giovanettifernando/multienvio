import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { requireUserId } from "../../helpers";
import { prisma } from "@/lib/db";
import { parsePanCipher, decryptPan, loadVaultKey } from "@/lib/crypto/card-vault";


/**
 * POST /api/account/cards/[id]/tokenize
 *
 * Returns decrypted card data needed for Mercado Pago tokenization.
 * This endpoint is production-safe and only returns data for immediate tokenization.
 *
 * Security:
 * - Requires authentication
 * - User must own the card
 * - Access is logged for audit
 * - PAN is only decrypted in-memory, never stored or logged
 */
export const POST = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const { id: cardId } = await params;
  const userId = await requireUserId(req);

  // Fetch card and verify ownership
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

  if (!card || card.userId !== userId) {
    throw new ApiError({
      code: "not_found",
      message: "Cartão não encontrado.",
      status: 404,
    });
  }

  // Decrypt PAN
  const cipher = parsePanCipher(card.panCipher);
  if (!cipher) {
    throw new ApiError({
      code: "pan_unavailable",
      message: "Dados do cartão não disponíveis para tokenização.",
      status: 404,
    });
  }

  const key = loadVaultKey();
  if (!key) {
    throw new ApiError({
      code: "vault_not_configured",
      message: "Vault não configurado.",
      status: 500,
    });
  }

  const pan = decryptPan(cipher, key);

  // Audit log - NEVER log the PAN itself
  logger?.audit?.("account.card.tokenize", {
    userId,
    cardId: card.id,
    brand: card.brand,
    last4: card.last4,
  });

  // Return data needed for MP tokenization
  return {
    data: {
      pan,
      holderName: card.holderName,
      expMonth: card.expMonth,
      expYear: card.expYear,
    },
    meta: { tags: ["account", "cards", "tokenize"] },
  };
});

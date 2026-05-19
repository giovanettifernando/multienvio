import { withApiHandler } from "@/platform/api/handler";
import { ApiError } from "@/platform/api/errors";
import { prisma } from "@/platform/db/db";
import {
  enforceCardWriteLimit,
  rethrowCardValidation,
  requireUserId,
} from "../helpers";
import {
  deleteUserCard,
  updateUserCard,
} from "@/modules/auth/application/account-cards.service";
import { validateCardUpdateInput } from '@/shared/validation/card';

type CardDtoResponse = {
  id: string;
  brand: string;
  holderName: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  billingAddressId: string | null;
  createdAt: string;
};

type UpdateCardResponse = CardDtoResponse;

type DeleteCardResponse = {
  deleted: boolean;
};

export const PUT = withApiHandler<UpdateCardResponse>(async (context) => {
  const { req, params, logger } = context;
  const { id } = await params;
  const userId = await requireUserId(req);

  await enforceCardWriteLimit(context);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    throw new ApiError({
      code: "invalid_payload",
      message: "JSON inválido.",
      status: 400,
    });
  }

  const normalized = (() => {
    try {
      return validateCardUpdateInput(payload);
    } catch (error) {
      rethrowCardValidation(error);
    }
  })();

  const card = await updateUserCard(userId, id, normalized, { logger });

  return {
    data: {
      ...card,
      createdAt: card.createdAt.toISOString(),
    },
    meta: { tags: ["account", "cards"] },
  };
});

export const DELETE = withApiHandler<DeleteCardResponse>(async (context) => {
  const { req, params, logger } = context;
  const { id } = await params;
  const userId = await requireUserId(req);

  await enforceCardWriteLimit(context);

  // Fetch vaultToken before deletion so we can clean up Pagar.me vault
  const cardBefore = await prisma.card.findUnique({
    where: { id },
    select: { vaultToken: true, userId: true },
  });

  await deleteUserCard(userId, id, { logger });

  // Delete from Pagar.me vault if token looks like a Pagar.me card id
  if (cardBefore?.userId === userId && cardBefore.vaultToken?.startsWith('card_')) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pagarmeCustomerId: true },
    });
    const customerId = user?.pagarmeCustomerId ?? undefined;
    if (customerId) {
      const { deletePagarmeCard } = await import('@/platform/integrations/pagarme');
      await deletePagarmeCard(customerId, cardBefore.vaultToken).catch((err: Error) => {
        console.warn('[PAGARME] Failed to delete card from vault:', err.message);
      });
    }
  }

  return {
    data: { deleted: true },
    meta: { tags: ["account", "cards"] },
  };
});

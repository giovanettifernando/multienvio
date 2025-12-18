import { withApiHandler } from "@/platform/api/handler";
import { ApiError } from "@/platform/api/errors";
import {
  enforceCardWriteLimit,
  rethrowCardValidation,
  requireUserId,
} from "../helpers";
import {
  deleteUserCard,
  updateUserCard,
  type AccountCardDto,
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
  await deleteUserCard(userId, id, { logger });

  return {
    data: { deleted: true },
    meta: { tags: ["account", "cards"] },
  };
});

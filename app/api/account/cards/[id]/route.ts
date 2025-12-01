import { withApiHandler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import {
  enforceCardWriteLimit,
  rethrowCardValidation,
  requireUserId,
} from "../helpers";
import {
  deleteUserCard,
  updateUserCard,
} from "@/lib/services/account-cards.service";
import { validateCardUpdateInput } from "@/lib/validation/card";


export const PUT = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const { id } = await params;
  const userId = await requireUserId(req);

  enforceCardWriteLimit(context);

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
    data: card,
    meta: { tags: ["account", "cards"] },
  };
});

export const DELETE = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const { id } = await params;
  const userId = await requireUserId(req);

  enforceCardWriteLimit(context);
  await deleteUserCard(userId, id, { logger });

  return {
    data: { deleted: true },
    meta: { tags: ["account", "cards"] },
  };
});

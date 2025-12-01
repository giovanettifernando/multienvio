import { withApiHandler } from "@/lib/api/handler";
import {
  createUserCard,
  listUserCards,
} from "@/lib/services/account-cards.service";
import {
  validateCardCreateInput,
} from "@/lib/validation/card";
import {
  enforceCardWriteLimit,
  parsePositiveInteger,
  rethrowCardValidation,
  requireUserId,
} from "./helpers";
import { ApiError } from "@/lib/api/errors";


export const GET = withApiHandler(async ({ req, logger }) => {
  const userId = await requireUserId(req);

  const search = req.nextUrl.searchParams;
  const page = parsePositiveInteger(search.get("page"), 1);
  const pageSize = parsePositiveInteger(search.get("pageSize"), 20);

  const result = await listUserCards(
    userId,
    { page, pageSize },
    { logger },
  );

  return {
    data: result,
    meta: { tags: ["account", "cards"] },
  };
});

export const POST = withApiHandler(async (context) => {
  const { req, logger } = context;
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

  let normalized;
  try {
    normalized = validateCardCreateInput(payload);
  } catch (error) {
    rethrowCardValidation(error);
  }

  const card = await createUserCard(userId, normalized, { logger });

  return {
    data: card,
    status: 201,
    meta: { tags: ["account", "cards"] },
  };
});

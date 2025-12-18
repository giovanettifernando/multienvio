import { withApiHandler } from "@/platform/api/handler";
import {
  createUserCard,
  listUserCards,
  type AccountCardDto,
} from "@/modules/auth/application/account-cards.service";
import {
  validateCardCreateInput,
} from '@/shared/validation/card';
import {
  enforceCardWriteLimit,
  parsePositiveInteger,
  rethrowCardValidation,
  requireUserId,
} from "./helpers";
import { ApiError } from "@/platform/api/errors";

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

type GetCardsResponse = {
  items: CardDtoResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type CreateCardResponse = CardDtoResponse;

export const GET = withApiHandler<GetCardsResponse>(async ({ req, logger }) => {
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
    data: {
      ...result,
      items: result.items.map(card => ({
        ...card,
        createdAt: card.createdAt.toISOString(),
      })),
    },
    meta: { tags: ["account", "cards"] },
  };
});

export const POST = withApiHandler<CreateCardResponse>(async (context) => {
  const { req, logger } = context;
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

  let normalized;
  try {
    normalized = validateCardCreateInput(payload);
  } catch (error) {
    rethrowCardValidation(error);
  }

  const card = await createUserCard(userId, normalized, { logger });

  return {
    data: {
      ...card,
      createdAt: card.createdAt.toISOString(),
    },
    status: 201,
    meta: { tags: ["account", "cards"] },
  };
});

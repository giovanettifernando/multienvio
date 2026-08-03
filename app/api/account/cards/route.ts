import { withApiHandler } from "@/platform/api/handler";
import {
  createUserCard,
  listUserCards,
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

  // Check for asaasToken first — token-based card save flow.
  // Diferente do Pagar.me, o Asaas não tem endpoint de "salvar no cofre": o
  // token da tokenização (Task 9) já é o valor persistível. Como a resposta
  // da tokenização não devolve holderName/validade, o cliente reenvia os
  // dados que já tinha preenchido no formulário original.
  const bodyObj = payload as Record<string, unknown>;
  if (typeof bodyObj.asaasToken === 'string') {
    const holderName = typeof bodyObj.holderName === 'string' ? bodyObj.holderName : undefined;
    const brand = typeof bodyObj.brand === 'string' ? bodyObj.brand : undefined;
    const last4 = typeof bodyObj.last4 === 'string' ? bodyObj.last4 : undefined;
    const expMonth = typeof bodyObj.expMonth === 'number' ? bodyObj.expMonth : undefined;
    const expYear = typeof bodyObj.expYear === 'number' ? bodyObj.expYear : undefined;

    if (!holderName || !brand || !last4 || !expMonth || !expYear) {
      throw new ApiError({
        code: "invalid_payload",
        message: "Dados do cartão incompletos para salvar o token.",
        status: 400,
      });
    }

    const { createUserCardFromAsaasToken } = await import('@/modules/auth/application/account-cards.service');
    const card = await createUserCardFromAsaasToken(userId, {
      token: bodyObj.asaasToken,
      brand,
      last4,
      holderName,
      expMonth,
      expYear,
    });
    return {
      data: { ...card, createdAt: card.createdAt.toISOString() },
      status: 201,
      meta: { tags: ["account", "cards"] },
    };
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

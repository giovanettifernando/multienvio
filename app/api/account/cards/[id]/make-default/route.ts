import { withApiHandler } from "@/lib/api/handler";
import {
  enforceCardWriteLimit,
  requireUserId,
} from "../../helpers";
import { makeUserCardDefault, type AccountCardDto } from "@/lib/services/account-cards.service";

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

type MakeDefaultCardResponse = CardDtoResponse;

export const POST = withApiHandler<MakeDefaultCardResponse>(async (context) => {
  const { req, params, logger } = context;
  const { id } = await params;
  const userId = await requireUserId(req);

  await enforceCardWriteLimit(context);

  const card = await makeUserCardDefault(userId, id, { logger });

  return {
    data: {
      ...card,
      createdAt: card.createdAt.toISOString(),
    },
    meta: { tags: ["account", "cards"] },
  };
});

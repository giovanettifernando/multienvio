import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { requireUserId } from "../../helpers";
import { getCardPanForDev } from "@/lib/services/account-cards.service";

const DEV_AUTH_HEADER = "x-dev-auth";

export const dynamic = "force-dynamic";

function ensureDevAuthorization(req: Request) {
  const expected = process.env.CARD_DEV_AUTH_TOKEN;
  if (!expected) {
    throw new ApiError({
      code: "forbidden",
      message: "Operação não autorizada.",
      status: 403,
    });
  }

  const provided = req.headers.get(DEV_AUTH_HEADER);
  if (!provided || provided !== expected) {
    throw new ApiError({
      code: "forbidden",
      message: "Credenciais inválidas.",
      status: 403,
    });
  }
}

export const POST = withApiHandler(async (context) => {
  const { req, params } = context;
  const { id } = await params;
  const userId = await requireUserId(req);

  ensureDevAuthorization(req);
  const pan = await getCardPanForDev(userId, id);

  return {
    data: { pan },
    meta: { tags: ["account", "cards"] },
  };
});

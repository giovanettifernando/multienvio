import { withApiHandler } from "@/lib/api/handler";
import {
  enforceCardWriteLimit,
  requireUserId,
} from "../../helpers";
import { makeUserCardDefault } from "@/lib/services/account-cards.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const { id } = await params;
  const userId = await requireUserId(req);

  enforceCardWriteLimit(context);

  const card = await makeUserCardDefault(userId, id, { logger });

  return {
    data: card,
    meta: { tags: ["account", "cards"] },
  };
});

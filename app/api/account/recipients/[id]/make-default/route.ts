import { withApiHandler } from "@/lib/api/handler";
import { makeRecipientDefault } from "@/lib/services/account-recipients.service";
import { enforceRecipientWriteLimit, requireUserId } from "../helpers";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const userId = await requireUserId(req);
  enforceRecipientWriteLimit(context);

  const { id } = await params;
  const recipient = await makeRecipientDefault(userId, id, { logger });

  return {
    data: recipient,
    meta: { tags: ["account", "recipients"] },
  };
});

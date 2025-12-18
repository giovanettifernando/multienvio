import { withApiHandler } from "@/platform/api/handler";
import { makeRecipientDefault, type AccountRecipientDto } from "@/modules/auth/application/account-recipients.service";
import { enforceRecipientWriteLimit, requireUserId, handleRecipientDataStoreError } from "../../helpers";

type MakeDefaultRecipientResponse = AccountRecipientDto;

export const POST = withApiHandler<MakeDefaultRecipientResponse>(async (context) => {
  const { req, params, logger } = context;
  const userId = await requireUserId(req);
  await enforceRecipientWriteLimit(context);

  const { id } = await params;
  try {
    const recipient = await makeRecipientDefault(userId, id, { logger });

    return {
      data: recipient,
      meta: { tags: ["account", "recipients"] },
    };
  } catch (error) {
    handleRecipientDataStoreError(error);
  }
});

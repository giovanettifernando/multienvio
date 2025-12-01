import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import {
  getRecipient,
  deleteRecipient,
  updateRecipient,
} from "@/lib/services/account-recipients.service";
import {
  validateRecipientUpdateInput,
} from "@/lib/validation/recipient";
import {
  enforceRecipientWriteLimit,
  mapRecipientValidationError,
  requireUserId,
  handleRecipientDataStoreError,
} from "../helpers";


export const GET = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const userId = await requireUserId(req);

  const { id } = await params;

  try {
    const recipient = await getRecipient(userId, id, { logger });

    return {
      data: recipient,
      meta: { tags: ["account", "recipients"] },
    };
  } catch (error) {
    handleRecipientDataStoreError(error);
  }
});

export const PUT = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const userId = await requireUserId(req);
  enforceRecipientWriteLimit(context);

  const { id } = await params;

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
    normalized = validateRecipientUpdateInput(payload);
  } catch (error) {
    mapRecipientValidationError(error);
  }

  try {
    const recipient = await updateRecipient(userId, id, normalized!, { logger });

    return {
      data: recipient,
      meta: { tags: ["account", "recipients"] },
    };
  } catch (error) {
    handleRecipientDataStoreError(error);
  }
});

export const DELETE = withApiHandler(async (context) => {
  const { req, params, logger } = context;
  const userId = await requireUserId(req);
  enforceRecipientWriteLimit(context);

  const { id } = await params;
  try {
    await deleteRecipient(userId, id, { logger });

    return {
      data: { deleted: true },
      meta: { tags: ["account", "recipients"] },
    };
  } catch (error) {
    handleRecipientDataStoreError(error);
  }
});

import { ApiError } from "@/platform/api/errors";
import { withApiHandler } from "@/platform/api/handler";
import {
  getRecipient,
  deleteRecipient,
  updateRecipient,
  type AccountRecipientDto,
} from "@/modules/auth/application/account-recipients.service";
import {
  validateRecipientUpdateInput,
} from '@/shared/validation/recipient';
import {
  enforceRecipientWriteLimit,
  mapRecipientValidationError,
  requireUserId,
  handleRecipientDataStoreError,
} from "../helpers";

type GetRecipientResponse = AccountRecipientDto;

type UpdateRecipientResponse = AccountRecipientDto;

type DeleteRecipientResponse = {
  deleted: boolean;
};

export const GET = withApiHandler<GetRecipientResponse>(async (context) => {
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

export const PUT = withApiHandler<UpdateRecipientResponse>(async (context) => {
  const { req, params, logger } = context;
  const userId = await requireUserId(req);
  await enforceRecipientWriteLimit(context);

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

export const DELETE = withApiHandler<DeleteRecipientResponse>(async (context) => {
  const { req, params, logger } = context;
  const userId = await requireUserId(req);
  await enforceRecipientWriteLimit(context);

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

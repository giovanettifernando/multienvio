import { withApiHandler } from "@/platform/api/handler";
import { ApiError } from "@/platform/api/errors";
import {
  createRecipient,
  listRecipients,
  type RecipientListResult,
  type AccountRecipientDto,
} from "@/modules/auth/application/account-recipients.service";
import {
  validateRecipientCreateInput,
} from '@/shared/validation/recipient';
import {
  enforceRecipientWriteLimit,
  mapRecipientValidationError,
  parsePositiveInteger,
  requireUserId,
  handleRecipientDataStoreError,
} from "./helpers";

type GetRecipientsResponse = RecipientListResult;

type CreateRecipientResponse = AccountRecipientDto;

export const GET = withApiHandler<GetRecipientsResponse>(async ({ req, logger }) => {
  const userId = await requireUserId(req);
  const search = req.nextUrl.searchParams;
  const q = search.get("q") ?? undefined;
  const city = search.get("city") ?? undefined;
  const uf = search.get("uf") ?? undefined;
  const cep = search.get("cep") ?? undefined;
  const page = parsePositiveInteger(search.get("page"), 1);
  const pageSize = parsePositiveInteger(search.get("pageSize"), 20);

  try {
    const result = await listRecipients(
      userId,
      { q, city, uf, cep, page, pageSize },
      { logger },
    );

    return {
      data: result,
      meta: { tags: ["account", "recipients"] },
    };
  } catch (error) {
    handleRecipientDataStoreError(error);
  }
});

export const POST = withApiHandler<CreateRecipientResponse>(async (context) => {
  const { req, logger } = context;
  const userId = await requireUserId(req);
  await enforceRecipientWriteLimit(context);

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
    normalized = validateRecipientCreateInput(payload);
  } catch (error) {
    mapRecipientValidationError(error);
  }

  try {
    const recipient = await createRecipient(userId, normalized!, { logger });

    return {
      data: recipient,
      status: 201,
      meta: { tags: ["account", "recipients"] },
    };
  } catch (error) {
    handleRecipientDataStoreError(error);
  }
});

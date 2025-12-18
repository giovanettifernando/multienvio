import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { RecurringItemCreateSchema } from '@/shared/validation/account';
import {
  listUserItems,
  createItem,
  type RecurringItemDto,
} from '@/modules/recurring-items/application';

type RecurringItemsListResponse = RecurringItemDto[];

export const GET = withApiHandler<RecurringItemsListResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const result = await listUserItems(session.userId);

  return { data: result };
});

type RecurringItemCreateResponse = RecurringItemDto;

export const POST = withApiHandler<RecurringItemCreateResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const body = await context.req.json();

  const validation = RecurringItemCreateSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { descricao, valorUnitario } = validation.data;

  const result = await createItem(session.userId, { descricao, valorUnitario });

  return { data: result };
});

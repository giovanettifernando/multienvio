import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { createPickupRequestSchema, listPickupsQuerySchema } from '@/shared/validation/pickup';
import { logger } from '@/platform/logging/logger';
import {
  listUserPickups,
  createPickupRequest,
} from '@/modules/coletas/application';
import type { PickupRequestsResponse } from '@/shared/types/pickup';

/**
 * GET /api/coletas
 * Lista pickup requests do usuário com filtros
 */
export const GET = withApiHandler<PickupRequestsResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const { searchParams } = new URL(context.req.url);

  const queryValidation = listPickupsQuerySchema.safeParse({
    page: searchParams.get('page') ?? '1',
    pageSize: searchParams.get('pageSize') ?? '10',
    status: searchParams.get('status') ?? undefined,
    dateStart: searchParams.get('dateStart') ?? undefined,
    dateEnd: searchParams.get('dateEnd') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    q: searchParams.get('q') ?? undefined,
  });

  const { page, pageSize, status, dateStart, dateEnd, city, q } = queryValidation.success
    ? queryValidation.data
    : { page: 1, pageSize: 10, status: 'PENDING,SCHEDULED', dateStart: undefined, dateEnd: undefined, city: undefined, q: '' };

  const result = await listUserPickups(
    session.userId,
    { status, dateStart, dateEnd, city, q },
    { page, pageSize }
  );

  return { data: result };
});

interface CreatePickupResponse {
  message: string;
  pickupRequest: {
    id: string;
    status: string;
    shipmentId: string;
    originCep: string;
    createdAt: string;
  };
}

/**
 * POST /api/coletas
 * Cria uma nova pickup request
 */
export const POST = withApiHandler<CreatePickupResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const body = await context.req.json();

  const validation = createPickupRequestSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'coletas_validation_error', errors: validation.error.flatten() }, 'Validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { shipmentId, windowStart, windowEnd, notes } = validation.data;

  const pickupRequest = await createPickupRequest(
    session.userId,
    { shipmentId, windowStart, windowEnd, notes }
  );

  return {
    data: {
      message: 'Coleta criada com sucesso',
      pickupRequest,
    },
    status: 201,
  };
});

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { calculatePickupFee } from '@/lib/services/pickupFee';
import { getUserFromRequest } from '@/lib/auth/session';
import { pickupFeeCalculateSchema } from '@/lib/validation/pickup';

interface PickupFeeResult {
  success: boolean;
  fee?: number;
  distance?: number;
  error?: string;
}

type PickupFeeCalculateResponse = PickupFeeResult;

/**
 * POST /api/pickup-fee/calculate
 *
 * Calcula taxa de coleta na origem para uma cotação
 */
export const POST = withApiHandler<PickupFeeCalculateResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const body = await context.req.json();

  // Validação com Zod
  const validation = pickupFeeCalculateSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { originCep, freightCost } = validation.data;

  // Calcular taxa de coleta
  const result = await calculatePickupFee(originCep, freightCost);

  if (!result.success) {
    throw new ApiError({
      code: 'pickup_fee_error',
      message: result.error || 'Erro ao calcular taxa de coleta',
      status: 400,
    });
  }

  return { data: result };
});

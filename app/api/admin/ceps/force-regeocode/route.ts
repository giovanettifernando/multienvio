/**
 * POST /api/admin/ceps/force-regeocode
 *
 * Força re-geocodificação de um CEP específico
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, type CepLocation } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { forceRegeocodeCep } from '@/lib/services/cepLocation';
import { z } from 'zod';

const forceRegeocodeSchema = z.object({
  cep: z.string().min(8).max(9),
});

type ForceRegeocodeResponse = {
  success: boolean;
  cepLocation: CepLocation;
  message: string;
};

export const POST = withApiHandler<ForceRegeocodeResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const rateLimitError = await rateLimitByUser(session.staffId, 'cep_regeocode', RATE_LIMITS.WRITE);
  if (rateLimitError) {
    throw new ApiError({ code: 'rate_limited', message: 'Muitas tentativas. Tente novamente mais tarde.', status: 429 });
  }

  const body = await req.json();
  const parsed = forceRegeocodeSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Validação falhou',
      status: 400,
      details: { errors: parsed.error.issues },
    });
  }

  const { cep } = parsed.data;

  context.logger.info('cep_force_regeocode_requested', { cep });

  const cepLocation = await forceRegeocodeCep(cep);

  context.logger.info('cep_force_regeocode_success', { cep });

  return {
    data: {
      success: true,
      cepLocation,
      message: `CEP ${cep} re-geocodificado com sucesso`,
    },
  };
});

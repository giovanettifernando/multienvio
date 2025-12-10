/**
 * POST /api/admin/ceps/manual-update
 *
 * Atualiza coordenadas de um CEP manualmente
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, type CepLocation } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { updateCepManual } from '@/lib/services/cepLocation';
import { z } from 'zod';

const manualUpdateSchema = z.object({
  cep: z.string().min(8).max(9),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.string().optional().default('manual'),
  motivo: z.string().optional(),
});

type ManualUpdateResponse = {
  success: boolean;
  cepLocation: CepLocation;
  message: string;
};

export const POST = withApiHandler<ManualUpdateResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const rateLimitError = await rateLimitByUser(session.staffId, 'cep_manual_update', RATE_LIMITS.WRITE);
  if (rateLimitError) {
    throw new ApiError({ code: 'rate_limited', message: 'Muitas tentativas. Tente novamente mais tarde.', status: 429 });
  }

  const body = await req.json();
  const parsed = manualUpdateSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Validação falhou',
      status: 400,
      details: { errors: parsed.error.issues },
    });
  }

  const { cep, lat, lng, precision, motivo } = parsed.data;

  context.logger.info('cep_manual_update_requested', { cep, lat, lng, precision, motivo });

  const cepLocation = await updateCepManual(cep, lat, lng, precision, motivo);

  context.logger.info('cep_manual_update_success', { cep });

  return {
    data: {
      success: true,
      cepLocation,
      message: `CEP ${cep} atualizado manualmente com sucesso. Protegido contra re-geocoding automático.`,
    },
  };
});

/**
 * GET /api/admin/ceps/list-low-precision
 *
 * Lista todos os CEPs com baixa precisão (state_fallback, city_fallback)
 * que ainda não foram corrigidos manualmente.
 *
 * Response:
 * {
 *   "success": true,
 *   "count": 5,
 *   "ceps": [
 *     {
 *       "cep": "58035100",
 *       "latitude": -7.1195,
 *       "longitude": -34.845,
 *       "precision": "state_fallback",
 *       "provider": "nominatim",
 *       "updatedAt": "2025-11-15T19:00:00.000Z"
 *     },
 *     ...
 *   ]
 * }
 */

import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { listLowPrecisionCeps } from '@/platform/integrations/shared/cepLocation';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

export const GET = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.OPERACOES);

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES) && !session.isSuperAdmin) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Acesso negado',
      status: 403,
    });
  }

  const ceps = await listLowPrecisionCeps();

  return {
    data: {
      success: true,
      count: ceps.length,
      ceps,
    },
  };
});

/**
 * GET /api/admin/ceps/list-manual-overrides
 *
 * Lista todos os CEPs que foram corrigidos manualmente (manualOverride=true)
 *
 * Response:
 * {
 *   "success": true,
 *   "count": 3,
 *   "ceps": [
 *     {
 *       "cep": "58035100",
 *       "latitude": -7.1198028,
 *       "longitude": -34.8623789,
 *       "precision": "address",
 *       "manualOverride": true,
 *       "manualOverrideReason": "Coordenadas corrigidas com Google Maps",
 *       "updatedAt": "2025-11-15T19:30:00.000Z"
 *     },
 *     ...
 *   ]
 * }
 */

import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { listManualOverrides } from '@/platform/integrations/shared/cepLocation';
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

  const ceps = await listManualOverrides();

  return {
    data: {
      success: true,
      count: ceps.length,
      ceps,
    },
  };
});

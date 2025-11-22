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

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { listManualOverrides } from '@/lib/services/cepLocation';

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.CONFIGURACOES);
  if (permissionError) return permissionError;

  try{

    const ceps = await listManualOverrides();

    return NextResponse.json({
      success: true,
      count: ceps.length,
      ceps,
    });
  } catch (error) {
    console.error('[API] List manual overrides error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao listar CEPs',
      },
      { status: 500 }
    );
  }
}

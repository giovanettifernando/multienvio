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

import { NextRequest, NextResponse } from 'next/server';
import { listLowPrecisionCeps } from '@/lib/services/cepLocation';

export async function GET(request: NextRequest) {
  try {
    // TODO: Adicionar autenticação admin aqui
    // const session = await getServerSession();
    // if (!session?.user?.role === 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const ceps = await listLowPrecisionCeps();

    return NextResponse.json({
      success: true,
      count: ceps.length,
      ceps,
    });
  } catch (error) {
    console.error('[API] List low precision CEPs error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao listar CEPs',
      },
      { status: 500 }
    );
  }
}

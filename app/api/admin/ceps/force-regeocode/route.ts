/**
 * POST /api/admin/ceps/force-regeocode
 *
 * Força re-geocodificação de um CEP específico
 *
 * Body:
 * {
 *   "cep": "58035100"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "cepLocation": {
 *     "cep": "58035100",
 *     "latitude": -7.1198028,
 *     "longitude": -34.8623789,
 *     "precision": "address",
 *     "provider": "nominatim",
 *     ...
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { forceRegeocodeCep } from '@/lib/services/cepLocation';
import { z } from 'zod';

const forceRegeocodeSchema = z.object({
  cep: z.string().min(8).max(9),
});

export async function POST(request: NextRequest) {
  try {
    // TODO: Adicionar autenticação admin aqui
    // const session = await getServerSession();
    // if (!session?.user?.role === 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const parsed = forceRegeocodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validação falhou',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { cep } = parsed.data;

    console.log(`[API] Force re-geocode requested for CEP: ${cep}`);

    const cepLocation = await forceRegeocodeCep(cep);

    console.log(`[API] Re-geocoding successful for CEP ${cep}`);

    return NextResponse.json({
      success: true,
      cepLocation,
      message: `CEP ${cep} re-geocodificado com sucesso`,
    });
  } catch (error) {
    console.error('[API] Force re-geocode error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao re-geocodificar CEP',
      },
      { status: 500 }
    );
  }
}

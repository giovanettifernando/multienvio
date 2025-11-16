/**
 * POST /api/admin/ceps/manual-update
 *
 * Atualiza coordenadas de um CEP manualmente
 *
 * Body:
 * {
 *   "cep": "58035100",
 *   "lat": -7.1198028,
 *   "lng": -34.8623789,
 *   "precision": "address",
 *   "motivo": "Coordenadas corrigidas com Google Maps - geocoding automático retornou state_fallback"
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
 *     "manualOverride": true,
 *     "manualOverrideReason": "...",
 *     ...
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateCepManual } from '@/lib/services/cepLocation';
import { z } from 'zod';

const manualUpdateSchema = z.object({
  cep: z.string().min(8).max(9),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.string().optional().default('manual'),
  motivo: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // TODO: Adicionar autenticação admin aqui
    // const session = await getServerSession();
    // if (!session?.user?.role === 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const parsed = manualUpdateSchema.safeParse(body);

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

    const { cep, lat, lng, precision, motivo } = parsed.data;

    console.log(`[API] Manual update requested for CEP: ${cep}`);
    console.log(`[API] Coordinates: ${lat}, ${lng}`);
    console.log(`[API] Precision: ${precision}`);
    console.log(`[API] Reason: ${motivo || 'Not specified'}`);

    const cepLocation = await updateCepManual(cep, lat, lng, precision, motivo);

    console.log(`[API] Manual update successful for CEP ${cep}`);

    return NextResponse.json({
      success: true,
      cepLocation,
      message: `CEP ${cep} atualizado manualmente com sucesso. Protegido contra re-geocoding automático.`,
    });
  } catch (error) {
    console.error('[API] Manual update error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar CEP manualmente',
      },
      { status: 500 }
    );
  }
}

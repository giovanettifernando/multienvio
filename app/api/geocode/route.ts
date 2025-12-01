import { NextRequest, NextResponse } from 'next/server';

import { geocodeCEP } from '@/lib/services/geocoding';

/**
 * GET /api/geocode?cep=58035100
 * Geocodifica um CEP e retorna lat/lng
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cep = searchParams.get('cep');

    if (!cep) {
      return NextResponse.json(
        { message: 'CEP é obrigatório' },
        { status: 400 }
      );
    }

    const result = await geocodeCEP(cep);

    if (!result.success) {
      return NextResponse.json(
        { message: result.error || 'Erro ao geocodificar CEP' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      cep,
      coordinates: result.coordinates,
    });
  } catch (error) {
    console.error('[GEOCODE_GET]', error);
    return NextResponse.json(
      { message: 'Erro ao geocodificar CEP' },
      { status: 500 }
    );
  }
}

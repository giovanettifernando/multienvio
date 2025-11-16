export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { calculatePickupFee } from '@/lib/services/pickupFee';
import { getSession } from '@/lib/auth/session';

/**
 * POST /api/pickup-fee/calculate
 *
 * Calcula taxa de coleta na origem para uma cotação
 *
 * Body:
 * {
 *   originCep: string;
 *   freightCost: number;
 * }
 *
 * Retorna:
 * {
 *   success: true;
 *   collector: { id, nome, pfNome, pjRazaoSocial };
 *   distanceKm: number;
 *   feeType: 'FIXED' | 'PER_KM';
 *   feeAmount: number;
 *   totalWithPickup: number;
 * }
 * ou
 * {
 *   success: false;
 *   error: string;
 * }
 */
export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { originCep, freightCost } = body;

    if (!originCep || typeof originCep !== 'string') {
      return NextResponse.json(
        { success: false, error: 'CEP de origem é obrigatório' },
        { status: 400 }
      );
    }

    if (freightCost === undefined || typeof freightCost !== 'number' || freightCost < 0) {
      return NextResponse.json(
        { success: false, error: 'Custo do frete é obrigatório e deve ser um número positivo' },
        { status: 400 }
      );
    }

    // Calcular taxa de coleta
    const result = await calculatePickupFee(originCep, freightCost);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PICKUP_FEE_CALCULATE]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao calcular taxa de coleta',
      },
      { status: 500 }
    );
  }
}

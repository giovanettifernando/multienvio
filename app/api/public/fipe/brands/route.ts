/**
 * GET /api/public/fipe/brands
 *
 * Lista marcas de veículos FIPE ativas (endpoint público para cadastro)
 * Query params:
 *   - vehicleType: 'cars' | 'motorcycles' | 'trucks' (default: 'cars')
 *   - search: filtro por nome (opcional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { FipeVehicleType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleType = (searchParams.get('vehicleType') || 'cars') as FipeVehicleType;
    const search = searchParams.get('search') || '';

    // Validar vehicleType
    if (!['cars', 'motorcycles', 'trucks'].includes(vehicleType)) {
      return NextResponse.json(
        { message: 'vehicleType inválido' },
        { status: 400 }
      );
    }

    const brands = await prisma.fipeVehicleBrand.findMany({
      where: {
        vehicleType,
        isActive: true,
        ...(search && {
          name: { contains: search, mode: 'insensitive' },
        }),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        fipeCode: true,
        name: true,
      },
    });

    return NextResponse.json({ brands });

  } catch (error) {
    console.error('[Public FIPE Brands] Erro:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar marcas' },
      { status: 500 }
    );
  }
}

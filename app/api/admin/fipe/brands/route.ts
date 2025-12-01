/**
 * GET /api/admin/fipe/brands
 *
 * Lista marcas de veículos FIPE ativas para uso em selects
 * Query params:
 *   - vehicleType: 'cars' | 'motorcycles' | 'trucks' (default: 'cars')
 *   - search: filtro por nome (opcional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db';
import type { FipeVehicleType } from '@prisma/client';


export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

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
    console.error('[FIPE Brands API] Erro:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar marcas' },
      { status: 500 }
    );
  }
}

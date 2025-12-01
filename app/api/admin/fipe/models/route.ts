/**
 * GET /api/admin/fipe/models
 *
 * Lista modelos de veículos FIPE ativos para uso em selects
 * Query params:
 *   - brandId: ID da marca (obrigatório)
 *   - search: filtro por nome (opcional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db';


export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const search = searchParams.get('search') || '';

    if (!brandId) {
      return NextResponse.json(
        { message: 'brandId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se marca existe
    const brand = await prisma.fipeVehicleBrand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true },
    });

    if (!brand) {
      return NextResponse.json(
        { message: 'Marca não encontrada' },
        { status: 404 }
      );
    }

    const models = await prisma.fipeVehicleModel.findMany({
      where: {
        brandId,
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

    return NextResponse.json({
      brand: brand.name,
      models,
    });

  } catch (error) {
    console.error('[FIPE Models API] Erro:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar modelos' },
      { status: 500 }
    );
  }
}

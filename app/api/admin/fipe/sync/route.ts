/**
 * POST /api/admin/fipe/sync
 *
 * Dispara sincronização manual da base FIPE
 * Requer permissão INTEGRACOES ou superAdmin
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { canAccess } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import { syncFipeBrandsAndModels, getFipeStats, type SyncOptions } from '@/lib/integrations/fipe';

export const dynamic = 'force-dynamic';

// Timeout maior para sync (5 minutos)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { isSuperAdmin: true, permissions: true, status: true },
  });

  if (!staff || staff.status !== 'ACTIVE') {
    return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
  }

  // Requer permissão INTEGRACOES ou superAdmin
  if (!canAccess(staff, AdminPermission.INTEGRACOES)) {
    return NextResponse.json({ message: 'Acesso negado - requer permissão INTEGRACOES' }, { status: 403 });
  }

  try {
    // Parse body para opções
    let options: SyncOptions = { vehicleTypes: ['cars'] };

    try {
      const body = await request.json();
      if (body.vehicleTypes && Array.isArray(body.vehicleTypes)) {
        options.vehicleTypes = body.vehicleTypes.filter(
          (t: string) => ['cars', 'motorcycles', 'trucks'].includes(t)
        );
      }
      if (typeof body.deactivateOld === 'boolean') {
        options.deactivateOld = body.deactivateOld;
      }
    } catch {
      // Corpo vazio ou inválido, usa defaults
    }

    // Executar sync
    const result = await syncFipeBrandsAndModels(options);

    // Buscar estatísticas atualizadas
    const stats = await getFipeStats();

    return NextResponse.json({
      success: result.errors.length === 0,
      result: {
        referenceCode: result.referenceCode,
        referenceMonth: result.referenceMonth,
        vehicleTypes: result.vehicleTypes,
        brands: result.brands,
        models: result.models,
        durationMs: result.durationMs,
        errorsCount: result.errors.length,
      },
      stats,
      errors: result.errors.length > 0 ? result.errors.slice(0, 20) : undefined,
    });

  } catch (error) {
    console.error('[FIPE Sync API] Erro:', error);
    return NextResponse.json(
      { message: 'Erro ao sincronizar FIPE', error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/fipe/sync
 *
 * Retorna estatísticas da base FIPE local
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { isSuperAdmin: true, permissions: true, status: true },
  });

  if (!staff || staff.status !== 'ACTIVE') {
    return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
  }

  if (!canAccess(staff, AdminPermission.INTEGRACOES)) {
    return NextResponse.json({ message: 'Acesso negado - requer permissão INTEGRACOES' }, { status: 403 });
  }

  try {
    const stats = await getFipeStats();

    // Buscar contagem por tipo de veículo
    const brandsByType = await prisma.fipeVehicleBrand.groupBy({
      by: ['vehicleType'],
      where: { isActive: true },
      _count: { id: true },
    });

    const modelsByType = await prisma.fipeVehicleModel.groupBy({
      by: ['vehicleType'],
      where: { isActive: true },
      _count: { id: true },
    });

    return NextResponse.json({
      stats,
      byVehicleType: {
        brands: brandsByType.reduce((acc, item) => {
          acc[item.vehicleType] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        models: modelsByType.reduce((acc, item) => {
          acc[item.vehicleType] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    });

  } catch (error) {
    console.error('[FIPE Stats API] Erro:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar estatísticas', error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

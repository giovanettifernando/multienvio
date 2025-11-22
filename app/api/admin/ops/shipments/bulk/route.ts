import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit';
import { updateShipments } from '@/lib/admin/ops/mockSeed';
import type { ShipmentStatus } from '@/lib/admin/ops/types';

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  const rateLimitError = rateLimitByUser(session.staffId, 'shipment_bulk', RATE_LIMITS.WRITE);
  if (rateLimitError) return rateLimitError;

  const body = await request.json();
  const { ids, status } = body as { ids: string[]; status: ShipmentStatus };

  updateShipments((shipments) =>
    shipments.map((s) =>
      ids.includes(s.id)
        ? { ...s, status, updatedAt: new Date().toISOString() }
        : s
    )
  );

  return NextResponse.json({ ok: true });
}

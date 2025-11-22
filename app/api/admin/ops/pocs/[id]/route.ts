import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit';
import { updatePoCs } from '@/lib/admin/ops/mockSeed';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  const rateLimitError = rateLimitByUser(session.staffId, 'poc_update', RATE_LIMITS.WRITE);
  if (rateLimitError) return rateLimitError;

  const { id } = await params;
  const body = await request.json();

  updatePoCs((pocs) =>
    pocs.map((p) => (p.id === id ? { ...p, ...body } : p))
  );

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  const rateLimitError = rateLimitByUser(session.staffId, 'commission_paid', RATE_LIMITS.FINANCE);
  if (rateLimitError) return rateLimitError;

  const { id } = await params;
  console.log('[Mock] Marking commission as paid:', id);
  return NextResponse.json({ ok: true });
}

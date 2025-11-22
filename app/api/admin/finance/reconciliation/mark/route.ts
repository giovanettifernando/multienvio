import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  const rateLimitError = rateLimitByUser(session.staffId, 'reconciliation_mark', RATE_LIMITS.FINANCE);
  if (rateLimitError) return rateLimitError;

  const body = await request.json();
  const { ids } = body;
  console.log('[Mock] Marking as reconciled:', ids);
  return NextResponse.json({ ok: true });
}

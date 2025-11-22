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

  const rateLimitError = rateLimitByUser(session.staffId, 'ledger_reconcile', RATE_LIMITS.FINANCE);
  if (rateLimitError) return rateLimitError;

  const body = await request.json();
  const { ids } = body;

  // Mock: just return success
  // In real implementation, would update DB
  console.log('[Mock] Reconciling ledger entries:', ids);

  return NextResponse.json({ ok: true });
}

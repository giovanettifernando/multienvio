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

  const rateLimitError = rateLimitByUser(session.staffId, 'ledger_adjustment', RATE_LIMITS.FINANCE);
  if (rateLimitError) return rateLimitError;

  const body = await request.json();

  // Mock: just return success with generated ID
  // In real implementation, would create entry in DB
  console.log('[Mock] Creating adjustment:', body);

  const id = `ldg_adj_${Date.now()}`;

  return NextResponse.json({ ok: true, id });
}

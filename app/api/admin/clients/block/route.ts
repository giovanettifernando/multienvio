import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { logClientStatusChange } from '@/lib/audit-admin';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  // Rate limiting
  const rateLimitError = rateLimitByUser(session.staffId, 'client_block', RATE_LIMITS.USER_MANAGEMENT);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const { clientId, reason } = body;

    // Mock: apenas retorna sucesso
    // Em produção, aqui bloquearia o cliente no banco

    // Audit log
    await logClientStatusChange(session.staffId, clientId, 'block', reason);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ADMIN_CLIENTS_BLOCK]', error);
    return NextResponse.json({ message: 'Erro ao bloquear cliente' }, { status: 500 });
  }
}

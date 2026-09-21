import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { getAdminSessionFromRequest, createAdminCookieRemovalHeader } from '@/modules/auth/application/admin-session';
import { staffSessionCache } from '@/platform/cache/cache';
import { requireValidOrigin } from '@/platform/api/csrf';

type AdminLogoutResponse = {
  message: string;
};

export const POST = withApiHandlerResponse<Record<string, never>>(async (context) => {
  const { req, logger } = context;

  // CSRF Protection - validar Origin header
  const csrfError = requireValidOrigin(req as NextRequest);
  if (csrfError) return csrfError;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    // Encerra só este aparelho; os outros seguem logados. Token de antes da
    // sessão por aparelho (sem sid) não tem como ser encerrado sozinho: nesse
    // caso a versão sobe e todos saem, como era antes.
    if (session.sid) {
      await staffSessionCache.closeDevice(session.staffId, session.sid);
    } else {
      await staffSessionCache.incrementTokenVersion(session.staffId);
    }

    logger.info('admin_logout_success', { staffId: session.staffId, device: Boolean(session.sid) });

    // Create response with cookie removal header
    const response = NextResponse.json({
      message: 'Logout realizado com sucesso',
    });

    // Remove admin auth cookie
    response.headers.set('Set-Cookie', createAdminCookieRemovalHeader());

    return response;
  } catch (error) {
    logger.error('admin_logout_error', { err: error });
    return NextResponse.json(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
});

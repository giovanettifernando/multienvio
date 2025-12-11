import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { destroySession, getSession } from '@/lib/auth/session';
import { sessionCache, userCache } from '@/lib/cache';

export const POST = withApiHandlerResponse(async (context) => {
  const { logger } = context;

  try {
    // Obter sessão atual para invalidar tokens
    const session = await getSession();

    if (session?.userId) {
      // INCR tokenVersion no Redis - invalida todos os tokens existentes
      const newVersion = await sessionCache.incrementTokenVersion(session.userId);

      // Invalidar cache de dados do usuário
      userCache.invalidate(session.userId).catch(() => {});

      logger.info('logout_success', { userId: session.userId, newTokenVersion: newVersion });
    } else {
      logger.info('logout_no_session');
    }

    // Remover cookies de autenticação
    await destroySession();

    return NextResponse.json({
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    logger.error('logout_error', { err: error });
    return NextResponse.json(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
});

import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { destroySession, getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { sessionCache, userCache } from '@/lib/cache';

export const POST = withApiHandlerResponse(async (context) => {
  const { logger } = context;

  try {
    // Obter sessão atual para invalidar tokens
    const session = await getSession();

    // Incrementar tokenVersion para invalidar todos os tokens existentes
    if (session?.userId) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { tokenVersion: { increment: 1 } },
      });

      // Invalidar caches Redis (session e user data)
      await Promise.all([
        sessionCache.invalidate(session.userId),
        userCache.invalidate(session.userId),
      ]).catch(() => {
        // Fire and forget - não bloqueia logout se Redis falhar
      });

      logger.info('logout_success', { userId: session.userId });
    } else {
      logger.info('logout_no_session');
    }

    // Remover cookie de autenticação
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

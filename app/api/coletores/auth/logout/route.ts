/**
 * API Route para logout de coletores autônomos
 * POST /api/coletores/auth/logout - Faz logout do coletor
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { getAutonomousCollectorSession, AUTONOMOUS_COLLECTOR_COOKIE_NAME } from '@/lib/auth/autonomous-collector-session';

type CollectorLogoutResponse = {
  message: string;
};

/**
 * POST /api/coletores/auth/logout
 * Remove cookie de autenticação e incrementa tokenVersion
 */
export const POST = withApiHandlerResponse(async (context) => {
  const { logger } = context;

  try {
    // Tentar obter a sessão atual para incrementar tokenVersion
    // Nota: getAutonomousCollectorSession usa cookies() então precisa ser chamado antes de modificar cookies
    const session = await getAutonomousCollectorSession();

    if (session?.coletorId) {
      // Incrementar tokenVersion para invalidar todos os tokens existentes
      await prisma.collector.update({
        where: { id: session.coletorId },
        data: { tokenVersion: { increment: 1 } },
      });
      logger.info('autonomous_collector_logout_success', { collectorId: session.coletorId });
    } else {
      logger.info('autonomous_collector_logout_no_session');
    }

    // Remover cookie
    const cookieStore = await cookies();
    cookieStore.delete(AUTONOMOUS_COLLECTOR_COOKIE_NAME);

    return NextResponse.json({
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    logger.error('autonomous_collector_logout_error', { err: error });
    return NextResponse.json(
      { message: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
});

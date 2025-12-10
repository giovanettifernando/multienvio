import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApiHandlerResponse } from '@/lib/api/handler';
import {
  createCollectorCookieRemovalHeader,
  getCollectorTokenFromRequest,
  collectorVerifySimple,
} from '@/lib/auth/collector-session';

type LogoutResponse = {
  message: string;
};

export const POST = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  try {
    // Tentar obter o ponto de coleta da sessão atual para incrementar tokenVersion
    const token = getCollectorTokenFromRequest(req);
    if (token) {
      const payload = await collectorVerifySimple(token);
      if (payload?.pointId) {
        // Incrementar tokenVersion para invalidar todos os tokens existentes
        await prisma.pickupPoint.update({
          where: { id: payload.pointId },
          data: { tokenVersion: { increment: 1 } },
        });
        logger.info('collector_logout_success', { pointId: payload.pointId });
      }
    } else {
      logger.info('collector_logout_no_session');
    }

    const response = NextResponse.json<LogoutResponse>({
      message: 'Logout realizado com sucesso',
    });

    response.headers.set('Set-Cookie', createCollectorCookieRemovalHeader());

    return response;
  } catch (error) {
    logger.error('collector_logout_error', { err: error });
    return NextResponse.json<LogoutResponse>(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
});

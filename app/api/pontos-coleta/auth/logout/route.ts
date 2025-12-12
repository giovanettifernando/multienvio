import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/lib/api/handler';
import {
  createCollectorCookieRemovalHeader,
  getCollectorTokenFromRequest,
  collectorVerifySimple,
} from '@/lib/auth/collector-session';
import { pickupPointSessionCache } from '@/lib/cache';

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
        // INCR tokenVersion no Redis - invalida todos os tokens existentes
        const newVersion = await pickupPointSessionCache.incrementTokenVersion(payload.pointId);
        logger.info('collector_logout_success', { pointId: payload.pointId, newTokenVersion: newVersion });
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

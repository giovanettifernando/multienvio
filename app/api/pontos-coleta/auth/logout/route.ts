
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  createCollectorCookieRemovalHeader,
  getCollectorTokenFromRequest,
  collectorVerifySimple,
} from '@/lib/auth/collector-session';

export async function POST(request: Request) {
  try {
    // Tentar obter o ponto de coleta da sessão atual para incrementar tokenVersion
    const token = getCollectorTokenFromRequest(request);
    if (token) {
      const payload = await collectorVerifySimple(token);
      if (payload?.pointId) {
        // Incrementar tokenVersion para invalidar todos os tokens existentes
        await prisma.pickupPoint.update({
          where: { id: payload.pointId },
          data: { tokenVersion: { increment: 1 } },
        });
        console.log('[COLLECTOR_LOGOUT] TokenVersion incremented for pointId:', payload.pointId);
      }
    }

    const response = NextResponse.json({
      message: 'Logout realizado com sucesso',
    });

    response.headers.set('Set-Cookie', createCollectorCookieRemovalHeader());

    return response;
  } catch (error) {
    console.error('[COLLECTOR_LOGOUT]', error);
    return NextResponse.json(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
}

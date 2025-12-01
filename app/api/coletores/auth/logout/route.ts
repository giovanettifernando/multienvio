/**
 * API Route para logout de coletores autônomos
 * POST /api/coletores/auth/logout - Faz logout do coletor
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession, AUTONOMOUS_COLLECTOR_COOKIE_NAME } from '@/lib/auth/autonomous-collector-session';

/**
 * POST /api/coletores/auth/logout
 * Remove cookie de autenticação e incrementa tokenVersion
 */
export async function POST(request: NextRequest) {
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
      console.log('[AUTONOMOUS_COLLECTOR_LOGOUT] TokenVersion incremented for collectorId:', session.coletorId);
    }

    // Remover cookie
    const cookieStore = await cookies();
    cookieStore.delete(AUTONOMOUS_COLLECTOR_COOKIE_NAME);

    return NextResponse.json({
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    console.error('[POST /api/coletores/auth/logout] Error:', error);
    // 🛡️ SECURITY FIX: Não expor mensagens de erro internas
    return NextResponse.json(
      { message: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}

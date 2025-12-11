/**
 * POST /api/auth/heartbeat
 *
 * Endpoint de keepalive para manter sessão ativa no servidor.
 * Atualiza o cookie `last_activity` para evitar timeout por inatividade.
 *
 * Este endpoint é chamado periodicamente pelo cliente enquanto o usuário
 * está ativo (mouse/teclado), garantindo que a atividade no cliente
 * seja refletida no servidor.
 *
 * Fluxo:
 * 1. Verifica se usuário está autenticado (access token válido)
 * 2. Se autenticado, atualiza cookie last_activity
 * 3. Retorna 200 OK
 * 4. Se não autenticado, retorna 401 (cliente deve tratar como sessão expirada)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyAccessToken,
  ACCESS_TOKEN_COOKIE,
} from '@/lib/auth/jwt-tokens';

const LAST_ACTIVITY_COOKIE_NAME = 'last_activity';

export async function POST(request: NextRequest) {
  try {
    // Obter access token do cookie
    const cookieStore = await cookies();
    const accessTokenCookie = cookieStore.get(ACCESS_TOKEN_COOKIE);

    if (!accessTokenCookie?.value) {
      return NextResponse.json(
        { error: 'not_authenticated' },
        { status: 401 }
      );
    }

    // Verificar se access token é válido (sem validar tokenVersion para performance)
    const { payload, error } = await verifyAccessToken(accessTokenCookie.value, false);

    if (error || !payload) {
      return NextResponse.json(
        { error: error || 'invalid_token' },
        { status: 401 }
      );
    }

    // Usuário autenticado - atualizar cookie de atividade
    const response = NextResponse.json({
      ok: true,
      timestamp: Date.now(),
    });

    // Setar cookie last_activity com timestamp atual
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, Date.now().toString(), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('[HEARTBEAT] Error:', error);
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500 }
    );
  }
}

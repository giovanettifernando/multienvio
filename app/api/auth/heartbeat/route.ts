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
 * IMPORTANTE: Usa REFRESH token (7 dias) ao invés de access token (15 min)
 * para evitar falsos positivos quando o access token expira mas a sessão
 * ainda é válida.
 *
 * Fluxo:
 * 1. Verifica se usuário tem refresh token válido
 * 2. Se sim, atualiza cookie last_activity
 * 3. Retorna 200 OK (com flag indicando se access token precisa refresh)
 * 4. Se não autenticado, retorna 401 (cliente deve tratar como sessão expirada)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyRefreshToken,
  verifyAccessToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/auth/jwt-tokens';

const LAST_ACTIVITY_COOKIE_NAME = 'last_activity';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Verificar REFRESH token (7 dias) - mais confiável que access token (15 min)
    const refreshTokenCookie = cookieStore.get(REFRESH_TOKEN_COOKIE);

    if (!refreshTokenCookie?.value) {
      return NextResponse.json(
        { error: 'not_authenticated', reason: 'no_refresh_token' },
        { status: 401 }
      );
    }

    // Verificar se refresh token é válido (sem validar tokenVersion para performance)
    const { payload: refreshPayload, error: refreshError } = await verifyRefreshToken(
      refreshTokenCookie.value,
      false // skipTokenVersionCheck para performance
    );

    if (refreshError || !refreshPayload) {
      return NextResponse.json(
        { error: refreshError || 'invalid_token', reason: 'refresh_invalid' },
        { status: 401 }
      );
    }

    // Verificar se access token precisa de refresh (para informar o cliente)
    const accessTokenCookie = cookieStore.get(ACCESS_TOKEN_COOKIE);
    let needsTokenRefresh = true;

    if (accessTokenCookie?.value) {
      const { error: accessError } = await verifyAccessToken(accessTokenCookie.value, false);
      needsTokenRefresh = !!accessError;
    }

    // Sessão válida - atualizar cookie de atividade
    const response = NextResponse.json({
      ok: true,
      timestamp: Date.now(),
      needsTokenRefresh, // Cliente pode usar isso para decidir se faz refresh
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

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
 * SEGURANÇA (FAIL-CLOSED):
 * - Valida tokenVersion no Redis para detectar logout/revogação
 * - Retorna 401 e limpa cookies se tokenVersion não bate ou sessão não existe
 *
 * Fluxo:
 * 1. Verifica se usuário tem refresh token válido
 * 2. Valida tokenVersion no Redis (fail-closed)
 * 3. Se tudo OK, atualiza cookie last_activity
 * 4. Retorna 200 OK (com flag indicando se access token precisa refresh)
 * 5. Se não autenticado ou revogado, retorna 401 e limpa cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyRefreshToken,
  verifyAccessToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/auth/jwt-tokens';
import { sessionCache } from '@/lib/cache';

const LAST_ACTIVITY_COOKIE_NAME = 'last_activity_user';

/**
 * Cria resposta 401 com cookies limpos
 */
function createUnauthorizedResponse(error: string, reason: string) {
  const response = NextResponse.json(
    { error, reason },
    { status: 401 }
  );

  // Limpar todos os cookies de autenticação
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

  return response;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Verificar REFRESH token (7 dias) - mais confiável que access token (15 min)
    const refreshTokenCookie = cookieStore.get(REFRESH_TOKEN_COOKIE);

    if (!refreshTokenCookie?.value) {
      return createUnauthorizedResponse('not_authenticated', 'no_refresh_token');
    }

    // Verificar se refresh token é válido (sem validar tokenVersion ainda - faremos manualmente)
    const { payload: refreshPayload, error: refreshError } = await verifyRefreshToken(
      refreshTokenCookie.value,
      false // skipTokenVersionCheck - faremos manualmente abaixo
    );

    if (refreshError || !refreshPayload) {
      return createUnauthorizedResponse(refreshError || 'invalid_token', 'refresh_invalid');
    }

    // FAIL-CLOSED: Validar tokenVersion no Redis
    const redisTokenVersion = await sessionCache.getTokenVersion(refreshPayload.userId);

    if (redisTokenVersion === null) {
      // Sessão não existe no Redis (expirou ou foi removida)
      console.warn('[HEARTBEAT] Session not found in Redis', { userId: refreshPayload.userId });
      return createUnauthorizedResponse('session_expired', 'session_not_in_redis');
    }

    if (redisTokenVersion !== refreshPayload.tokenVersion) {
      // Token foi revogado (logout foi feito ou senha alterada)
      console.warn('[HEARTBEAT] Token version mismatch', {
        userId: refreshPayload.userId,
        tokenVersion: refreshPayload.tokenVersion,
        redisVersion: redisTokenVersion,
      });
      return createUnauthorizedResponse('token_revoked', 'token_version_mismatch');
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
    // Em caso de erro (ex: Redis indisponível), retornar 401 para fail-closed
    return createUnauthorizedResponse('internal_error', 'server_error');
  }
}

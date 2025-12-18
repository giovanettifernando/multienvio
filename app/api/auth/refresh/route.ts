/**
 * POST /api/auth/refresh
 *
 * Renova o access token usando o refresh token
 * - Valida refresh token do cookie
 * - Verifica tokenVersion no Redis (fail-closed)
 * - Gera novo par de tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiHandlerResponse } from '@/platform/api/handler';
import {
  verifyRefreshToken,
  signTokenPair,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from '@/modules/auth/application/jwt-tokens';
import { rateLimitByIP, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { sessionCache } from '@/platform/cache/cache';
import { requireValidOrigin } from '@/platform/api/csrf';

export const POST = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  // CSRF Protection - validar Origin header
  const csrfError = requireValidOrigin(req as NextRequest);
  if (csrfError) return csrfError;

  // Rate limiting - mais permissivo que login (refresh acontece automaticamente)
  const rateLimitError = await rateLimitByIP(req as NextRequest, 'auth_refresh', {
    windowMs: RATE_LIMITS.LOGIN.windowMs,
    maxRequests: 30, // 30 refreshes por janela de tempo
  });
  if (rateLimitError) return rateLimitError;

  // Obter refresh token do cookie usando a API de cookies do Next.js
  const cookieStore = await cookies();
  const refreshTokenCookie = cookieStore.get(REFRESH_TOKEN_COOKIE);

  if (!refreshTokenCookie?.value) {
    logger.debug('refresh_no_token', {});
    return NextResponse.json(
      { message: 'Sessão expirada' },
      { status: 401 }
    );
  }

  const refreshToken = refreshTokenCookie.value;

  // Verificar refresh token
  const { payload, error } = await verifyRefreshToken(refreshToken, true);

  if (error || !payload) {
    logger.warn('refresh_invalid', { error });

    // Limpar cookies inv�lidos
    const response = NextResponse.json(
      { message: error === 'expired' ? 'Sess�o expirada. Fa�a login novamente.' : 'Sess�o inv�lida' },
      { status: 401 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });

    return response;
  }

  // Obter sessão do Redis (fail-closed - sem fallback para DB)
  const sessionData = await sessionCache.get(payload.userId);

  // Cache miss = sessão não existe → 401 (força login)
  if (!sessionData) {
    logger.warn('refresh_no_session', { userId: payload.userId });

    const response = NextResponse.json(
      { message: 'Sessão expirada. Faça login novamente.' },
      { status: 401 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });

    return response;
  }

  // Verificar status do usuário
  if (sessionData.status !== 'active') {
    logger.warn('refresh_user_inactive', { userId: payload.userId, status: sessionData.status });

    const response = NextResponse.json(
      { message: 'Conta inativa ou bloqueada' },
      { status: 401 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });

    return response;
  }

  // Verificar tokenVersion (proteção contra logout)
  const redisTokenVersion = await sessionCache.getTokenVersion(payload.userId);

  if (redisTokenVersion === null || redisTokenVersion !== payload.tokenVersion) {
    logger.warn('refresh_token_version_mismatch', {
      userId: payload.userId,
      expected: redisTokenVersion,
      received: payload.tokenVersion,
    });

    const response = NextResponse.json(
      { message: 'Sessão invalidada. Faça login novamente.' },
      { status: 401 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });

    return response;
  }

  // Gerar novo par de tokens (mantendo o mesmo tokenVersion)
  const { accessToken, refreshToken: newRefreshToken } = await signTokenPair({
    userId: sessionData.userId,
    email: sessionData.email,
    role: sessionData.role,
    tokenVersion: redisTokenVersion,
  });

  // Renovar TTL da sessão no Redis (janela deslizante)
  // Isso garante que usuários ativos não sejam deslogados após 7 dias fixos
  await sessionCache.set(sessionData.userId, {
    userId: sessionData.userId,
    email: sessionData.email,
    role: sessionData.role,
    status: sessionData.status,
    tokenVersion: redisTokenVersion,
  });

  logger.info('refresh_success', { userId: sessionData.userId });

  // Criar resposta com novos tokens
  const response = NextResponse.json({
    message: 'Token renovado com sucesso',
  });

  // Setar novos cookies
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });

  return response;
});

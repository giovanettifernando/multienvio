/**
 * POST /api/auth/refresh
 *
 * Renova o access token usando o refresh token
 * - Valida refresh token do cookie
 * - Verifica tokenVersion no banco
 * - Gera novo par de tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import {
  verifyRefreshToken,
  signTokenPair,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from '@/lib/auth/jwt-tokens';
import { rateLimitByIP, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { sessionCache, type SessionCacheData } from '@/lib/cache';

export const POST = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

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

  // Tentar obter sessão do Redis primeiro (evita hit no banco)
  let sessionData: SessionCacheData | null = await sessionCache.get(payload.userId);
  let needsCacheUpdate = false;

  // Se não encontrou no cache, buscar do banco
  if (!sessionData) {
    logger.debug('refresh_cache_miss', { userId: payload.userId });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user) {
      logger.warn('refresh_user_not_found', { userId: payload.userId });

      const response = NextResponse.json(
        { message: 'Conta não encontrada' },
        { status: 401 }
      );

      response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
      response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });

      return response;
    }

    // Mapear dados do banco para cache
    sessionData = {
      userId: user.id,
      email: user.email,
      role: user.role?.name || 'user',
      status: user.status,
      tokenVersion: user.tokenVersion,
    };
    needsCacheUpdate = true;
  }

  // Verificar status do usuário
  if (sessionData.status !== 'active') {
    logger.warn('refresh_user_inactive', { userId: payload.userId, status: sessionData.status });

    // Invalidar cache se usuário ficou inativo
    sessionCache.invalidate(payload.userId).catch(() => {});

    const response = NextResponse.json(
      { message: 'Conta inativa ou bloqueada' },
      { status: 401 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });

    return response;
  }

  // Verificar tokenVersion (proteção contra logout em outros dispositivos)
  if (payload.tokenVersion !== undefined && sessionData.tokenVersion !== payload.tokenVersion) {
    logger.warn('refresh_token_version_mismatch', {
      userId: payload.userId,
      expected: sessionData.tokenVersion,
      received: payload.tokenVersion,
    });

    // Invalidar cache - versão do token mudou
    sessionCache.invalidate(payload.userId).catch(() => {});

    const response = NextResponse.json(
      { message: 'Sessão invalidada' },
      { status: 401 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });

    return response;
  }

  // Atualizar cache se veio do banco
  if (needsCacheUpdate) {
    sessionCache.set(payload.userId, sessionData).catch(() => {});
  }

  // Gerar novo par de tokens
  const { accessToken, refreshToken: newRefreshToken } = await signTokenPair({
    userId: sessionData.userId,
    email: sessionData.email,
    role: sessionData.role,
    tokenVersion: sessionData.tokenVersion,
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

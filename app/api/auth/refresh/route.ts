/**
 * POST /api/auth/refresh
 *
 * Renova o access token usando o refresh token
 * - Valida refresh token do cookie
 * - Verifica tokenVersion no banco
 * - Gera novo par de tokens
 */

import { NextRequest, NextResponse } from 'next/server';
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

export const POST = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  // Rate limiting - mais permissivo que login (refresh acontece automaticamente)
  const rateLimitError = await rateLimitByIP(req as NextRequest, 'auth_refresh', {
    windowMs: RATE_LIMITS.LOGIN.windowMs,
    maxRequests: 30, // 30 refreshes por janela de tempo
  });
  if (rateLimitError) return rateLimitError;

  // Obter refresh token do cookie
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) {
    logger.debug('refresh_no_cookie', {});
    return NextResponse.json(
      { message: 'Sess�o expirada' },
      { status: 401 }
    );
  }

  // Parsear cookies
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return acc;
    const key = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const refreshToken = cookies[REFRESH_TOKEN_COOKIE];
  if (!refreshToken) {
    logger.debug('refresh_no_token', {});
    return NextResponse.json(
      { message: 'Sess�o expirada' },
      { status: 401 }
    );
  }

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

  // Buscar dados atualizados do usu�rio
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    logger.warn('refresh_user_inactive', { userId: payload.userId, status: user?.status });

    const response = NextResponse.json(
      { message: 'Conta inativa ou n�o encontrada' },
      { status: 401 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });

    return response;
  }

  // Gerar novo par de tokens
  const { accessToken, refreshToken: newRefreshToken } = await signTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role?.name || 'user',
    tokenVersion: user.tokenVersion,
  });

  logger.info('refresh_success', { userId: user.id });

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

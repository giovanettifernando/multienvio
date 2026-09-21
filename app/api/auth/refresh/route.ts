/**
 * POST /api/auth/refresh
 *
 * SECURITY: Token Rotation - renova tokens com nova versão
 * - Valida refresh token do cookie
 * - Verifica tokenVersion no Redis (fail-closed)
 * - INCREMENTA tokenVersion (invalidando tokens anteriores)
 * - Gera novo par de tokens com novo tokenVersion
 *
 * Isso previne ataques de replay: uma vez que os tokens são renovados,
 * os tokens anteriores se tornam imediatamente inválidos.
 */

import type { NextRequest } from 'next/server';
import { createRefreshHandler } from '@/platform/auth/refresh-handler';
import {
  verifyRefreshToken,
  signTokenPair,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  type TokenPayload,
} from '@/modules/auth/application/jwt-tokens';
import { RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { sessionCache, type SessionCacheData } from '@/platform/cache/cache';

const isProduction = process.env.NODE_ENV === 'production';

export const POST = createRefreshHandler<TokenPayload, SessionCacheData>({
  actorName: 'user',
  sessionCache,
  activeStatuses: ['active'],

  getIdFromPayload: (payload) => payload.userId,
  getStatusFromSession: (session) => session.status,
  getTokenVersionFromPayload: (payload) => payload.tokenVersion,
  getSidFromPayload: (payload) => payload.sid,

  getToken: (req) => (req as NextRequest).cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null,

  verifyToken: async (token) => {
    const result = await verifyRefreshToken(token, true);
    return { payload: result.payload, error: result.error };
  },

  signToken: async (_payload, session, tokenVersion, sid) => {
    return signTokenPair({
      userId: session.userId,
      email: session.email,
      role: session.role,
      tokenVersion,
      sid,
    });
  },

  setAuthCookies: (response, tokens) => {
    if (typeof tokens === 'string') return;

    response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    });
  },

  clearAuthCookies: (response) => {
    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
  },

  rateLimit: {
    key: 'auth_refresh',
    config: {
      windowMs: RATE_LIMITS.LOGIN.windowMs,
      maxRequests: 30,
    },
  },
});

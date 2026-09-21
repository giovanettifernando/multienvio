/**
 * Customer/Client Session Management
 *
 * - Access Token: curta duração (15min), usado em todas as requisições
 * - Refresh Token: longa duração (7 dias), usado para renovar access token
 * - Idle timeout: YES (10 min by default, configured in proxy.ts)
 * - TokenVersion: YES (validated on every session check for logout invalidation)
 *
 * @see lib/auth/jwt-tokens.ts para geração e verificação de tokens
 */

import { cookies } from 'next/headers';
import { logger } from '@/platform/logging/logger';
import {
  verifyAccessToken,
  signTokenPair,
  signAccessToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  type TokenPayload,
  type TokenVerifyError,
} from './jwt-tokens';

// Re-export para compatibilidade com código existente
export const AUTH_COOKIE_NAME = ACCESS_TOKEN_COOKIE;

// Re-export tipos para compatibilidade
export type JWTVerifyError = TokenVerifyError;

// Tipo do payload do JWT (mantém compatibilidade)
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion: number;
  /** Sessão do aparelho. Tokens antigos não têm. */
  sid?: string;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Assina um payload e gera um JWT (access token)
 * @deprecated Use signAccessToken ou signTokenPair de jwt-tokens.ts
 */
export async function sign(payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>): Promise<string> {
  return signAccessToken(payload);
}

/**
 * Verifica e decodifica um JWT (access token)
 * @returns Objeto com payload e erro, se houver
 */
export async function verify(
  token: string,
  validateTokenVersion: boolean = false
): Promise<{ payload: JWTPayload | null; error: JWTVerifyError }> {
  const result = await verifyAccessToken(token, validateTokenVersion);
  return {
    payload: result.payload as JWTPayload | null,
    error: result.error,
  };
}

/**
 * Verifica JWT e retorna apenas o payload (mantém compatibilidade com código existente)
 */
export async function verifySimple(token: string, validateTokenVersion: boolean = false): Promise<JWTPayload | null> {
  const { payload } = await verify(token, validateTokenVersion);
  return payload;
}

/**
 * Seta o cookie de autenticação (access token)
 * @deprecated Use setAuthCookies para setar ambos os cookies
 */
export async function setAuthCookie(token: string, rememberMe: boolean = false): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: rememberMe ? ACCESS_TOKEN_MAX_AGE_SECONDS : undefined,
  });
}

/**
 * Seta ambos os cookies de autenticação (access + refresh)
 */
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean = true
): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: rememberMe ? ACCESS_TOKEN_MAX_AGE_SECONDS : undefined,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: rememberMe ? REFRESH_TOKEN_MAX_AGE_SECONDS : undefined,
  });
}

/**
 * Remove os cookies de autenticação
 */
export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  const clearOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };

  cookieStore.set(ACCESS_TOKEN_COOKIE, '', clearOptions);
  cookieStore.set(REFRESH_TOKEN_COOKIE, '', clearOptions);
}

/**
 * Obtém o token do cookie
 */
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Obtém o payload do JWT a partir do cookie
 */
export async function getSession(): Promise<JWTPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;

  // Sempre validar tokenVersion ao obter sessão
  return verifySimple(token, true);
}

/**
 * Cria um par de tokens e seta os cookies em uma única operação
 */
export async function createSession(
  payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>,
  rememberMe: boolean = true
): Promise<string> {
  const { accessToken, refreshToken } = await signTokenPair(payload);
  await setAuthCookies(accessToken, refreshToken, rememberMe);
  return accessToken;
}

/**
 * Remove a sessão (logout)
 */
export async function destroySession(): Promise<void> {
  await removeAuthCookie();
}

/**
 * Obtém o usuário a partir do request (via cookie)
 * Útil para API routes
 */
export async function getUserFromRequest(request: Request): Promise<JWTPayload | null> {
  try {
    // Obter cookie do request
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    // Parsear cookies (usando indexOf para preservar '=' no valor do JWT)
    const parsedCookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const trimmed = cookie.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return acc;
      const key = trimmed.substring(0, eqIndex);
      const value = trimmed.substring(eqIndex + 1);
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = parsedCookies[AUTH_COOKIE_NAME];
    if (!token) return null;

    // Verificar e decodificar JWT (sempre validar tokenVersion)
    return verifySimple(token, true);
  } catch (error) {
    logger.error({
      event: 'session_get_user_error',
      err: error instanceof Error ? { message: error.message, name: error.name } : error,
    }, 'Error getting user from request');
    return null;
  }
}

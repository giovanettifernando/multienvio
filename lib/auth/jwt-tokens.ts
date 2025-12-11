/**
 * JWT Token Management - Access Token + Refresh Token
 *
 * Estratégia de segurança:
 * - Access Token: curta duração (15min), usado em todas as requisições
 * - Refresh Token: longa duração (7 dias), usado apenas para renovar access token
 * - Ambos validam tokenVersion para permitir logout global
 *
 * Configuração via env:
 * - ACCESS_TOKEN_TTL_MINUTES: duração do access token (default: 15)
 * - REFRESH_TOKEN_TTL_DAYS: duração do refresh token (default: 7)
 */

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { logger } from '@/lib/logger';
import { sessionCache } from '@/lib/cache';

// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    'SECURITY ERROR: JWT_SECRET environment variable is required in production.'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const JWT_ALGORITHM = 'HS256';

// TTLs configuráveis via env
const ACCESS_TOKEN_TTL_MINUTES = parseInt(process.env.ACCESS_TOKEN_TTL_MINUTES || '15', 10);
const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10);

// Constantes exportadas para uso em cookies
export const ACCESS_TOKEN_EXPIRATION = `${ACCESS_TOKEN_TTL_MINUTES}m`;
export const REFRESH_TOKEN_EXPIRATION = `${REFRESH_TOKEN_TTL_DAYS}d`;
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * ACCESS_TOKEN_TTL_MINUTES;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * REFRESH_TOKEN_TTL_DAYS;

// Nomes dos cookies
export const ACCESS_TOKEN_COOKIE = 'auth_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// Tipos de token
export type TokenType = 'access' | 'refresh';

// Payload base do JWT
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion: number;
  type: TokenType;
  iat?: number;
  exp?: number;
}

// Erros de verificação
export type TokenVerifyError = 'expired' | 'invalid' | 'token_version_mismatch' | 'wrong_type' | null;

export interface TokenVerifyResult {
  payload: TokenPayload | null;
  error: TokenVerifyError;
}

/**
 * Gera um Access Token (curta duração)
 */
export async function signAccessToken(
  payload: Omit<TokenPayload, 'iat' | 'exp' | 'type'>
): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' } as Record<string, unknown>)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
    .sign(JWT_SECRET);
}

/**
 * Gera um Refresh Token (longa duração)
 */
export async function signRefreshToken(
  payload: Omit<TokenPayload, 'iat' | 'exp' | 'type'>
): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' } as Record<string, unknown>)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRATION)
    .sign(JWT_SECRET);
}

/**
 * Gera par de tokens (access + refresh)
 */
export async function signTokenPair(
  payload: Omit<TokenPayload, 'iat' | 'exp' | 'type'>
): Promise<{ accessToken: string; refreshToken: string }> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ]);

  return { accessToken, refreshToken };
}

/**
 * Verifica um token (access ou refresh)
 * @param expectedType - Se especificado, valida que o token é do tipo correto
 */
export async function verifyToken(
  token: string,
  expectedType?: TokenType,
  validateTokenVersion: boolean = false
): Promise<TokenVerifyResult> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const tokenPayload = payload as unknown as TokenPayload;

    // Validar tipo do token
    if (expectedType && tokenPayload.type !== expectedType) {
      logger.warn({
        event: 'token_wrong_type',
        expected: expectedType,
        actual: tokenPayload.type,
      }, 'Token type mismatch');
      return { payload: null, error: 'wrong_type' };
    }

    // Validar tokenVersion - Redis primeiro, fallback para banco
    if (validateTokenVersion && tokenPayload.userId) {
      // Tentar obter do Redis primeiro (rápido)
      const cachedSession = await sessionCache.get(tokenPayload.userId);

      if (cachedSession) {
        // Cache hit - validar tokenVersion do cache
        if (cachedSession.tokenVersion !== tokenPayload.tokenVersion) {
          logger.warn({
            event: 'token_version_mismatch',
            userId: tokenPayload.userId,
            tokenVersion: tokenPayload.tokenVersion,
            currentVersion: cachedSession.tokenVersion,
            source: 'cache',
          }, 'Token version mismatch - session invalidated');
          return { payload: null, error: 'token_version_mismatch' };
        }
      } else {
        // Cache miss - buscar do banco
        logger.debug({ event: 'token_version_cache_miss', userId: tokenPayload.userId }, 'Session cache miss - checking database');

        const { prisma } = await import('../db');
        const user = await prisma.user.findUnique({
          where: { id: tokenPayload.userId },
          select: { tokenVersion: true },
        });

        if (!user || user.tokenVersion !== tokenPayload.tokenVersion) {
          logger.warn({
            event: 'token_version_mismatch',
            userId: tokenPayload.userId,
            tokenVersion: tokenPayload.tokenVersion,
            currentVersion: user?.tokenVersion,
            source: 'database',
          }, 'Token version mismatch - session invalidated');
          return { payload: null, error: 'token_version_mismatch' };
        }
      }
    }

    return { payload: tokenPayload, error: null };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      logger.debug({ event: 'token_expired' }, 'JWT expired');
      return { payload: null, error: 'expired' };
    }

    logger.error({
      event: 'token_verification_failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : error,
    }, 'JWT verification failed');
    return { payload: null, error: 'invalid' };
  }
}

/**
 * Verifica Access Token
 */
export async function verifyAccessToken(
  token: string,
  validateTokenVersion: boolean = true
): Promise<TokenVerifyResult> {
  return verifyToken(token, 'access', validateTokenVersion);
}

/**
 * Verifica Refresh Token
 */
export async function verifyRefreshToken(
  token: string,
  validateTokenVersion: boolean = true
): Promise<TokenVerifyResult> {
  return verifyToken(token, 'refresh', validateTokenVersion);
}

/**
 * Extrai payload sem validar (útil para obter userId de token expirado)
 * ATENÇÃO: Não confiar nos dados - usar apenas para logging/debugging
 */
export function decodeTokenUnsafe(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

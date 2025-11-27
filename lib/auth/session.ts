/**
 * Customer/Client Session Management
 *
 * - TTL: Configured via CLIENT_SESSION_TTL_DAYS env (default: 7 days)
 * - Idle timeout: YES (10 min by default, configured in proxy.ts)
 * - TokenVersion: YES (validated on every session check for logout invalidation)
 */

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { cookies } from 'next/headers';

// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent token forgery.'
  );
}

// Configuração do JWT
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'envio-legal-secret-key-change-in-production'
);
const JWT_ALGORITHM = 'HS256';

// TTL configurável via env (default: 7 dias)
const SESSION_TTL_DAYS = parseInt(process.env.CLIENT_SESSION_TTL_DAYS || '7', 10);
const JWT_EXPIRATION = `${SESSION_TTL_DAYS}d`;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * SESSION_TTL_DAYS;

// Nome do cookie
export const AUTH_COOKIE_NAME = 'auth_token';

// Tipos de erro de verificação JWT
export type JWTVerifyError = 'expired' | 'invalid' | 'token_version_mismatch' | null;

// Tipo do payload do JWT
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion: number; // Versão do token para invalidação de sessões
  iat?: number;
  exp?: number;
}

/**
 * Assina um payload e gera um JWT
 */
export async function sign(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const jwt = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(JWT_SECRET);

  return jwt;
}

/**
 * Verifica e decodifica um JWT
 * @returns Objeto com payload e erro, se houver
 */
export async function verify(
  token: string,
  validateTokenVersion: boolean = false
): Promise<{ payload: JWTPayload | null; error: JWTVerifyError }> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const jwtPayload = payload as unknown as JWTPayload;

    // Se solicitado, validar tokenVersion contra o banco de dados
    if (validateTokenVersion && jwtPayload.userId) {
      const { prisma } = await import('../db');
      const user = await prisma.user.findUnique({
        where: { id: jwtPayload.userId },
        select: { tokenVersion: true },
      });

      // Se o usuário não existe ou o tokenVersion não bate, token inválido
      if (!user || user.tokenVersion !== jwtPayload.tokenVersion) {
        console.warn('[CLIENT_SESSION] Token version mismatch - session invalidated');
        return { payload: null, error: 'token_version_mismatch' };
      }
    }

    return { payload: jwtPayload, error: null };
  } catch (error) {
    // Detectar erro de token expirado especificamente
    if (error instanceof joseErrors.JWTExpired) {
      console.warn('[CLIENT_SESSION] JWT expired');
      return { payload: null, error: 'expired' };
    }
    console.error('[CLIENT_SESSION] JWT verification failed:', error);
    return { payload: null, error: 'invalid' };
  }
}

/**
 * Verifica JWT e retorna apenas o payload (mantém compatibilidade com código existente)
 */
export async function verifySimple(token: string, validateTokenVersion: boolean = false): Promise<JWTPayload | null> {
  const { payload } = await verify(token, validateTokenVersion);
  return payload;
}

/**
 * Seta o cookie de autenticação
 * Por padrão, cookie de sessão (sem Max-Age) - fecha ao fechar o navegador
 * Para "lembrar de mim", passar rememberMe: true
 */
export async function setAuthCookie(token: string, rememberMe: boolean = false): Promise<void> {
  const cookieStore = await cookies();

  const cookieOptions: Record<string, unknown> = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  // Se "lembrar de mim", adicionar maxAge (usa SESSION_TTL_DAYS)
  if (rememberMe) {
    cookieOptions.maxAge = COOKIE_MAX_AGE_SECONDS;
  }
  // Caso contrário, cookie de sessão (sem maxAge) - fecha ao fechar navegador

  cookieStore.set(AUTH_COOKIE_NAME, token, cookieOptions as Parameters<typeof cookieStore.set>[2]);
}

/**
 * Remove o cookie de autenticação
 */
export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Expira imediatamente
  });
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
 * Cria um token e seta o cookie em uma única operação
 */
export async function createSession(payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): Promise<string> {
  const token = await sign(payload);
  await setAuthCookie(token, rememberMe);
  return token;
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

    // Parsear cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies[AUTH_COOKIE_NAME];
    if (!token) return null;

    // Verificar e decodificar JWT (sempre validar tokenVersion)
    return verifySimple(token, true);
  } catch (error) {
    console.error('[CLIENT_SESSION] Error getting user from request:', error);
    return null;
  }
}

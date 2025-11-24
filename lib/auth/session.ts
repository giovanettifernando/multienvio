import { SignJWT, jwtVerify } from 'jose';
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
const JWT_EXPIRATION = '7d'; // 7 dias

// Nome do cookie
export const AUTH_COOKIE_NAME = 'auth_token';

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
 */
export async function verify(token: string, validateTokenVersion: boolean = false): Promise<JWTPayload | null> {
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
        console.warn('Token version mismatch - session invalidated', {
          userId: jwtPayload.userId,
          tokenVersion: jwtPayload.tokenVersion,
          currentVersion: user?.tokenVersion,
        });
        return null;
      }
    }

    return jwtPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
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

  // Se "lembrar de mim", adicionar maxAge (7 dias)
  if (rememberMe) {
    cookieOptions.maxAge = 60 * 60 * 24 * 7; // 7 dias em segundos
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
  return verify(token, true);
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
    return verify(token, true);
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}

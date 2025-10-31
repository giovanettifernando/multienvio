import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

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
export async function verify(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Seta o cookie de autenticação
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias em segundos
  });
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

  return verify(token);
}

/**
 * Cria um token e seta o cookie em uma única operação
 */
export async function createSession(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const token = await sign(payload);
  await setAuthCookie(token);
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

    // Verificar e decodificar JWT
    return verify(token);
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}

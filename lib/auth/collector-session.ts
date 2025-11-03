import { SignJWT, jwtVerify } from 'jose';

// Configuração do JWT para Pontos de Coleta (separado de admin e usuário)
const COLLECTOR_JWT_SECRET = new TextEncoder().encode(
  process.env.COLLECTOR_JWT_SECRET || 'collector-secret-key-change-in-production'
);
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRATION = '12h'; // 12 horas
const JWT_ISSUER = 'enviolegal-collector';
const JWT_AUDIENCE = 'collector';

// Nome do cookie collector (separado de admin e user)
export const COLLECTOR_AUTH_COOKIE_NAME = 'collector_auth';

// Tipo do payload do JWT Collector
export interface CollectorJWTPayload {
  pointId: string; // ID do ponto de coleta
  cnpj: string;
  nomeFantasia: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/**
 * Assina um payload e gera um JWT para ponto de coleta
 */
export async function collectorSign(payload: Omit<CollectorJWTPayload, 'iss' | 'aud' | 'iat' | 'exp'>): Promise<string> {
  const jwt = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(COLLECTOR_JWT_SECRET);

  return jwt;
}

/**
 * Verifica e decodifica um JWT Collector
 */
export async function collectorVerify(token: string): Promise<CollectorJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, COLLECTOR_JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as unknown as CollectorJWTPayload;
  } catch (error) {
    console.error('Collector JWT verification failed:', error);
    return null;
  }
}

/**
 * Cria um header Set-Cookie para o collector_auth
 */
export function createCollectorCookieHeader(token: string): string {
  const maxAge = 60 * 60 * 12; // 12 horas em segundos
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';

  return `${COLLECTOR_AUTH_COOKIE_NAME}=${token}; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/**
 * Cria um header Set-Cookie para remover o collector_auth
 */
export function createCollectorCookieRemovalHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';

  return `${COLLECTOR_AUTH_COOKIE_NAME}=; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Extrai o token collector do cookie header de uma Request
 */
export function getCollectorTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const collectorCookie = cookies.find(c => c.startsWith(`${COLLECTOR_AUTH_COOKIE_NAME}=`));

  if (!collectorCookie) return null;

  return collectorCookie.split('=')[1] || null;
}

/**
 * Obtém a sessão collector a partir de uma Request
 */
export async function getCollectorSessionFromRequest(request: Request): Promise<CollectorJWTPayload | null> {
  const token = getCollectorTokenFromRequest(request);
  if (!token) {
    console.log('[COLLECTOR_SESSION] No token found in request');
    return null;
  }

  const payload = await collectorVerify(token);
  if (payload) {
    console.log('[COLLECTOR_SESSION] Valid session for pointId:', payload.pointId);
  } else {
    console.log('[COLLECTOR_SESSION] Invalid token');
  }

  return payload;
}

/**
 * Pickup Point (Ponto de Coleta) Session Management
 *
 * - TTL: Configured via COLLECTOR_SESSION_TTL_HOURS env (default: 12 hours)
 * - Idle timeout: NO (only fixed JWT expiration)
 * - TokenVersion: YES (validated on every session check for logout invalidation)
 */

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { prisma } from '@/lib/db';

// Validar COLLECTOR_JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.COLLECTOR_JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: COLLECTOR_JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent collector token forgery.'
  );
}

// Configuração do JWT para Pontos de Coleta (separado de admin e usuário) - Nunca usar fallbacks em produção
const COLLECTOR_JWT_SECRET = new TextEncoder().encode(process.env.COLLECTOR_JWT_SECRET!);
const JWT_ALGORITHM = 'HS256';

// TTL configurável via env (default: 12 horas)
const SESSION_TTL_HOURS = parseInt(process.env.COLLECTOR_SESSION_TTL_HOURS || '12', 10);
const JWT_EXPIRATION = `${SESSION_TTL_HOURS}h`;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * SESSION_TTL_HOURS;

const JWT_ISSUER = 'enviolegal-collector';
const JWT_AUDIENCE = 'collector';

// Nome do cookie collector (separado de admin e user)
export const COLLECTOR_AUTH_COOKIE_NAME = 'collector_auth';

// Tipos de erro de verificação JWT
export type CollectorJWTVerifyError = 'expired' | 'invalid' | 'token_version_mismatch' | 'point_inactive' | null;

// Tipo do payload do JWT Collector
export interface CollectorJWTPayload {
  pointId: string; // ID do ponto de coleta
  cnpj: string;
  nomeFantasia: string;
  tokenVersion: number; // Para invalidação de sessão via logout
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
 * @returns Objeto com payload e erro, se houver
 */
export async function collectorVerify(token: string): Promise<{ payload: CollectorJWTPayload | null; error: CollectorJWTVerifyError }> {
  try {
    const { payload } = await jwtVerify(token, COLLECTOR_JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return { payload: payload as unknown as CollectorJWTPayload, error: null };
  } catch (error) {
    // Detectar erro de token expirado especificamente
    if (error instanceof joseErrors.JWTExpired) {
      console.warn('[COLLECTOR_SESSION] JWT expired');
      return { payload: null, error: 'expired' };
    }
    console.error('[COLLECTOR_SESSION] JWT verification failed:', error);
    return { payload: null, error: 'invalid' };
  }
}

/**
 * Verifica JWT Collector e retorna apenas o payload (compatibilidade)
 */
export async function collectorVerifySimple(token: string): Promise<CollectorJWTPayload | null> {
  const { payload } = await collectorVerify(token);
  return payload;
}

/**
 * Cria um header Set-Cookie para o collector_auth
 */
export function createCollectorCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';

  return `${COLLECTOR_AUTH_COOKIE_NAME}=${token}; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;
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
 * Valida tokenVersion contra o banco de dados
 */
export async function getCollectorSessionFromRequest(request: Request): Promise<CollectorJWTPayload | null> {
  const token = getCollectorTokenFromRequest(request);
  if (!token) {
    console.log('[COLLECTOR_SESSION] No token found in request');
    return null;
  }

  const jwtPayload = await collectorVerifySimple(token);
  if (!jwtPayload) {
    console.log('[COLLECTOR_SESSION] Invalid token');
    return null;
  }

  // Validar tokenVersion contra o banco de dados
  const point = await prisma.pickupPoint.findUnique({
    where: { id: jwtPayload.pointId },
    select: { tokenVersion: true, status: true },
  });

  if (!point) {
    console.log('[COLLECTOR_SESSION] Pickup point not found:', jwtPayload.pointId);
    return null;
  }

  if (point.tokenVersion !== jwtPayload.tokenVersion) {
    console.log('[COLLECTOR_SESSION] Token version mismatch. Expected:', point.tokenVersion, 'Got:', jwtPayload.tokenVersion);
    return null;
  }

  if (point.status !== 'ACTIVE') {
    console.log('[COLLECTOR_SESSION] Pickup point is not active:', point.status);
    return null;
  }

  console.log('[COLLECTOR_SESSION] Valid session for pointId:', jwtPayload.pointId);
  return jwtPayload;
}

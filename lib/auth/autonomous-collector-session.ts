/**
 * Autonomous Collector (Coletor Autônomo) Session Management
 * Separate from pickup points (pontos de coleta)
 *
 * - TTL: 7 days (configured in login route via CLIENT_SESSION_TTL_DAYS)
 * - Idle timeout: NO (only fixed JWT expiration)
 * - TokenVersion: YES (validated on every session check for logout invalidation)
 */

import { cookies } from 'next/headers';
import { jwtVerify, errors as joseErrors } from 'jose';
import { collectorSessionCache } from '@/lib/cache';

// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent token forgery.'
  );
}

// JWT Secret - Nunca usar fallbacks em produção
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

// Cookie name for autonomous collectors
export const AUTONOMOUS_COLLECTOR_COOKIE_NAME = 'coletor-token';

// Tipos de erro de verificação JWT
export type AutonomousCollectorJWTVerifyError = 'expired' | 'invalid' | 'token_version_mismatch' | 'collector_inactive' | null;

export interface AutonomousCollectorSession {
  coletorId: string;
  pfEmail: string;
  pfNome: string;
  pjRazaoSocial: string;
  status: string;
  tokenVersion: number;
}

/**
 * Get autonomous collector session from JWT cookie
 * Cookie name: 'coletor-token' (set during login at /api/coletores/auth/login)
 * Validates tokenVersion against database
 * @returns Collector session payload or null if not authenticated
 */
export async function getAutonomousCollectorSession(): Promise<AutonomousCollectorSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTONOMOUS_COLLECTOR_COOKIE_NAME);

    if (!token?.value) {
      return null;
    }

    const { payload } = await jwtVerify(token.value, JWT_SECRET);

    if (!payload.coletorId || typeof payload.coletorId !== 'string') {
      return null;
    }

    const session: AutonomousCollectorSession = {
      coletorId: payload.coletorId as string,
      pfEmail: payload.pfEmail as string,
      pfNome: payload.pfNome as string,
      pjRazaoSocial: payload.pjRazaoSocial as string,
      status: payload.status as string,
      tokenVersion: (payload.tokenVersion as number) ?? 0,
    };

    // Verificar tokenVersion no Redis (fail-closed)
    const redisTokenVersion = await collectorSessionCache.getTokenVersion(session.coletorId);

    // Cache miss = sessão não existe → null
    if (redisTokenVersion === null) {
      console.log('[AUTONOMOUS_COLLECTOR_SESSION] Session not found in Redis:', session.coletorId);
      return null;
    }

    // Mismatch = logout foi feito ou sessão inválida → null
    if (redisTokenVersion !== session.tokenVersion) {
      console.log('[AUTONOMOUS_COLLECTOR_SESSION] Token version mismatch. Expected:', redisTokenVersion, 'Got:', session.tokenVersion);
      return null;
    }

    // Verificar status na sessão Redis
    const cachedSession = await collectorSessionCache.get(session.coletorId);
    if (!cachedSession || cachedSession.status !== 'ACTIVE') {
      console.log('[AUTONOMOUS_COLLECTOR_SESSION] Collector is not active:', cachedSession?.status);
      return null;
    }

    return session;
  } catch (error) {
    // Detectar erro de token expirado especificamente
    if (error instanceof joseErrors.JWTExpired) {
      console.warn('[AUTONOMOUS_COLLECTOR_SESSION] JWT expired');
      return null;
    }
    console.error('[AUTONOMOUS_COLLECTOR_SESSION] Error:', error);
    return null;
  }
}

/**
 * Require autonomous collector session or throw error
 * Use this in API routes that require authentication
 * @returns Collector session payload
 * @throws Error with code 'UNAUTHORIZED' if not authenticated
 */
export async function requireAutonomousCollectorSession(): Promise<AutonomousCollectorSession> {
  const session = await getAutonomousCollectorSession();

  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}

/**
 * Extract collectorId from session (convenience function)
 * @returns collectorId string
 * @throws Error if not authenticated
 */
export async function getCollectorId(): Promise<string> {
  const session = await requireAutonomousCollectorSession();
  return session.coletorId;
}

/**
 * Remove the autonomous collector cookie
 */
export function createAutonomousCollectorCookieRemovalHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';

  return `${AUTONOMOUS_COLLECTOR_COOKIE_NAME}=; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=0`;
}

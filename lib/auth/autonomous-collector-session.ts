/**
 * Utility functions for autonomous collector (coletor autônomo) authentication and session management
 * Separate from pickup points (pontos de coleta)
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent token forgery.'
  );
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

export interface AutonomousCollectorSession {
  coletorId: string;
  pfEmail: string;
  pfNome: string;
  pjRazaoSocial: string;
  status: string;
}

/**
 * Get autonomous collector session from JWT cookie
 * Cookie name: 'coletor-token' (set during login at /api/coletores/auth/login)
 * @returns Collector session payload or null if not authenticated
 */
export async function getAutonomousCollectorSession(): Promise<AutonomousCollectorSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('coletor-token');

    if (!token?.value) {
      return null;
    }

    const { payload } = await jwtVerify(token.value, JWT_SECRET);

    if (!payload.coletorId || typeof payload.coletorId !== 'string') {
      return null;
    }

    return {
      coletorId: payload.coletorId as string,
      pfEmail: payload.pfEmail as string,
      pfNome: payload.pfNome as string,
      pjRazaoSocial: payload.pjRazaoSocial as string,
      status: payload.status as string,
    };
  } catch (error) {
    console.error('[getAutonomousCollectorSession] Error:', error);
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

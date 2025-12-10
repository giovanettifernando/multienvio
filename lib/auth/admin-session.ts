/**
 * Admin/Staff Session Management
 *
 * - TTL: Configured via ADMIN_SESSION_TTL_DAYS env (default: 7 days)
 * - Idle timeout: YES (10 min by default, configured in proxy.ts via SESSION_IDLE_MINUTES)
 * - TokenVersion: YES (validated on every session check for logout invalidation)
 */

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';

// Validar ADMIN_JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: ADMIN_JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent admin token forgery.'
  );
}

// Configuração do JWT para Admin (separado do cliente) - Nunca usar fallbacks em produção
const ADMIN_JWT_SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);
const JWT_ALGORITHM = 'HS256';

// TTL configurável via env (default: 7 dias)
const SESSION_TTL_DAYS = parseInt(process.env.ADMIN_SESSION_TTL_DAYS || '7', 10);
const JWT_EXPIRATION = `${SESSION_TTL_DAYS}d`;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * SESSION_TTL_DAYS;

const JWT_ISSUER = 'enviolegal-admin';
const JWT_AUDIENCE = 'admin';

// Nome do cookie admin (separado do cliente)
export const ADMIN_AUTH_COOKIE_NAME = 'admin_auth';

// Tipos de erro de verificação JWT
export type AdminJWTVerifyError = 'expired' | 'invalid' | 'token_version_mismatch' | 'user_inactive' | null;

// Tipo do payload do JWT Admin
export interface AdminJWTPayload {
  staffId: string;
  email: string;
  role?: string;
  isSuperAdmin: boolean;
  permissions: AdminPermission[];
  tokenVersion: number;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/**
 * Assina um payload e gera um JWT para admin
 */
export async function adminSign(payload: Omit<AdminJWTPayload, 'iss' | 'aud' | 'iat' | 'exp'>): Promise<string> {
  // Convert payload to plain object to ensure all fields are serialized
  const jwtPayload = {
    staffId: payload.staffId,
    email: payload.email,
    role: payload.role,
    isSuperAdmin: payload.isSuperAdmin || false,
    permissions: payload.permissions || [],
    tokenVersion: payload.tokenVersion,
  };

  const jwt = await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(ADMIN_JWT_SECRET);

  return jwt;
}

/**
 * Verifica e decodifica um JWT Admin
 * @returns Objeto com payload e erro, se houver
 */
export async function adminVerify(token: string): Promise<{ payload: AdminJWTPayload | null; error: AdminJWTVerifyError }> {
  try {
    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const decoded = payload as unknown as AdminJWTPayload;
    return { payload: decoded, error: null };
  } catch (error) {
    // Detectar erro de token expirado especificamente
    if (error instanceof joseErrors.JWTExpired) {
      return { payload: null, error: 'expired' };
    }
    // Token invalid or wrong issuer/audience
    return { payload: null, error: 'invalid' };
  }
}

/**
 * Verifica JWT Admin e retorna apenas o payload (compatibilidade)
 */
export async function adminVerifySimple(token: string): Promise<AdminJWTPayload | null> {
  const { payload } = await adminVerify(token);
  return payload;
}

/**
 * Cria um header Set-Cookie para o admin_auth
 */
export function createAdminCookieHeader(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production';

  // Em desenvolvimento (localhost HTTP), usar SameSite=Lax sem Secure
  // Em produção (HTTPS), usar Secure com SameSite=Lax para melhor segurança
  const cookieAttributes = isProduction
    ? 'Secure; SameSite=Lax'
    : 'SameSite=Lax';

  return `${ADMIN_AUTH_COOKIE_NAME}=${token}; HttpOnly; ${cookieAttributes}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;
}

/**
 * Cria um header Set-Cookie para remover o admin_auth
 */
export function createAdminCookieRemovalHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';

  return `${ADMIN_AUTH_COOKIE_NAME}=; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Extrai o token admin do cookie header de uma Request
 */
export function getAdminTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const adminCookie = cookies.find(c => c.startsWith(`${ADMIN_AUTH_COOKIE_NAME}=`));

  if (!adminCookie) return null;

  return adminCookie.split('=')[1] || null;
}

/**
 * Obtém a sessão admin a partir de uma Request
 * Valida o tokenVersion contra o banco de dados
 */
export async function getAdminSessionFromRequest(request: Request): Promise<AdminJWTPayload | null> {
  const token = getAdminTokenFromRequest(request);
  if (!token) return null;

  const jwtPayload = await adminVerifySimple(token);
  if (!jwtPayload) return null;

  // Validate tokenVersion against database
  const staffUser = await prisma.staffUser.findUnique({
    where: { id: jwtPayload.staffId },
    select: { tokenVersion: true, status: true },
  });

  if (!staffUser) {
    return null;
  }

  if (staffUser.tokenVersion !== jwtPayload.tokenVersion) {
    return null;
  }

  if (staffUser.status !== 'ACTIVE') {
    return null;
  }

  return jwtPayload;
}

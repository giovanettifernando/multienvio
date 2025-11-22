import { SignJWT, jwtVerify } from 'jose';
import type { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';

// Validar ADMIN_JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: ADMIN_JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent admin token forgery.'
  );
}

// Configuração do JWT para Admin (separado do cliente)
const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-in-production'
);
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRATION = '7d'; // 7 dias
const JWT_ISSUER = 'enviolegal-admin';
const JWT_AUDIENCE = 'admin';

// Nome do cookie admin (separado do cliente)
export const ADMIN_AUTH_COOKIE_NAME = 'admin_auth';

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
  console.log('[ADMIN_SIGN] Creating JWT with payload:', {
    staffId: payload.staffId,
    email: payload.email,
    isSuperAdmin: payload.isSuperAdmin,
    permissions: payload.permissions,
    permissionsType: typeof payload.permissions,
    permissionsIsArray: Array.isArray(payload.permissions),
  });

  // Convert payload to plain object to ensure all fields are serialized
  const jwtPayload = {
    staffId: payload.staffId,
    email: payload.email,
    role: payload.role,
    isSuperAdmin: payload.isSuperAdmin || false,
    permissions: payload.permissions || [],
    tokenVersion: payload.tokenVersion,
  };

  console.log('[ADMIN_SIGN] JWT payload after conversion:', jwtPayload);

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
 */
export async function adminVerify(token: string): Promise<AdminJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const decoded = payload as unknown as AdminJWTPayload;
    console.log('[ADMIN_VERIFY] Decoded JWT payload:', {
      staffId: decoded.staffId,
      email: decoded.email,
      isSuperAdmin: decoded.isSuperAdmin,
      permissions: decoded.permissions,
      permissionsType: typeof decoded.permissions,
      permissionsIsArray: Array.isArray(decoded.permissions),
    });
    return decoded;
  } catch (error) {
    // Token invalid, expired, or wrong issuer/audience
    console.error('Admin JWT verification failed:', error);
    return null;
  }
}

/**
 * Cria um header Set-Cookie para o admin_auth
 */
export function createAdminCookieHeader(token: string): string {
  const maxAge = 60 * 60 * 24 * 7; // 7 dias em segundos
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';

  return `${ADMIN_AUTH_COOKIE_NAME}=${token}; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=${maxAge}`;
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

  const jwtPayload = await adminVerify(token);
  if (!jwtPayload) return null;

  // Validate tokenVersion against database
  const staffUser = await prisma.staffUser.findUnique({
    where: { id: jwtPayload.staffId },
    select: { tokenVersion: true, status: true },
  });

  if (!staffUser) {
    console.log('[ADMIN_SESSION] Staff user not found:', jwtPayload.staffId);
    return null;
  }

  if (staffUser.tokenVersion !== jwtPayload.tokenVersion) {
    console.log('[ADMIN_SESSION] Token version mismatch. Expected:', staffUser.tokenVersion, 'Got:', jwtPayload.tokenVersion);
    return null;
  }

  if (staffUser.status !== 'ACTIVE') {
    console.log('[ADMIN_SESSION] Staff user is not active:', staffUser.status);
    return null;
  }

  return jwtPayload;
}

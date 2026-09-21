/**
 * POST /api/admin/auth/refresh
 *
 * SECURITY: Token Rotation - renova token JWT admin com nova versão
 * - Valida token atual do cookie
 * - Verifica tokenVersion no Redis (fail-closed)
 * - INCREMENTA tokenVersion (invalidando tokens anteriores)
 * - Gera novo token com novo tokenVersion
 * - Renova TTL da sessão no Redis
 *
 * Isso previne ataques de replay: uma vez que o token é renovado,
 * o token anterior se torna imediatamente inválido.
 */

import { createRefreshHandler } from '@/platform/auth/refresh-handler';
import {
  getAdminTokenFromRequest,
  adminVerify,
  adminSign,
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE_SECONDS,
  type AdminJWTPayload,
} from '@/modules/auth/application/admin-session';
import { staffSessionCache, type StaffSessionCacheData } from '@/platform/cache/cache';

const LAST_ACTIVITY_COOKIE_NAME = 'last_activity_admin';
const isProduction = process.env.NODE_ENV === 'production';

export const POST = createRefreshHandler<AdminJWTPayload, StaffSessionCacheData>({
  actorName: 'admin',
  sessionCache: staffSessionCache,
  activeStatuses: ['ACTIVE'],

  getIdFromPayload: (payload) => payload.staffId,
  getStatusFromSession: (session) => session.status,
  getTokenVersionFromPayload: (payload) => payload.tokenVersion,
  getSidFromPayload: (payload) => payload.sid,

  getToken: (req) => getAdminTokenFromRequest(req),

  verifyToken: async (token) => {
    const result = await adminVerify(token);
    return { payload: result.payload, error: result.error };
  },

  signToken: async (payload, _session, tokenVersion, sid) => {
    return adminSign({
      staffId: payload.staffId,
      email: payload.email,
      role: payload.role,
      isSuperAdmin: payload.isSuperAdmin,
      permissions: payload.permissions,
      tokenVersion,
      sid,
    });
  },

  // Usar response.cookies.set() ao invés de headers.set('Set-Cookie', ...)
  // para consistência com o cliente e evitar problemas com múltiplos cookies
  setAuthCookies: (response, tokens) => {
    if (typeof tokens !== 'string') return;
    response.cookies.set(ADMIN_AUTH_COOKIE_NAME, tokens, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
    });
  },

  clearAuthCookies: (response) => {
    response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
    response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  },

  setExtraCookies: (response) => {
    response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, Date.now().toString(), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  },
});

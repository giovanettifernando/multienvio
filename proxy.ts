/**
 * Next.js 16 Proxy - replaces middleware.ts
 * Runtime is always Node.js (not Edge) - Prisma works here
 *
 * Session/Inactivity Timeout Rules:
 * - ADMIN (admin_auth): Has idle timeout (SESSION_IDLE_MINUTES, default 10min)
 *   Cookie: last_activity_admin
 * - CLIENT (auth_token): Has idle timeout (SESSION_IDLE_MINUTES, default 10min)
 *   Cookie: last_activity_user
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, errors as joseErrors } from 'jose';
import { getRouteProtection } from '@/modules/auth/application/route-protection';
import { sessionCache, staffSessionCache } from '@/platform/cache/cache';

// Validar JWT secrets em produção
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    throw new Error('🚨 SECURITY: JWT_SECRET required in production');
  }
  if (!process.env.ADMIN_JWT_SECRET) {
    throw new Error('🚨 SECURITY: ADMIN_JWT_SECRET required in production');
  }
} else {
  // ⚠️ WARNING: Usando secrets padrão em desenvolvimento - NÃO usar em produção
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ SECURITY WARNING: JWT_SECRET not set, using insecure default. Set JWT_SECRET in environment variables.');
  }
  if (!process.env.ADMIN_JWT_SECRET) {
    console.warn('⚠️ SECURITY WARNING: ADMIN_JWT_SECRET not set, using insecure default. Set ADMIN_JWT_SECRET in environment variables.');
  }
}

// JWT Secrets (customer vs admin) - Nunca usar fallbacks em produção
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const ADMIN_JWT_SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);

// Cookie names
const AUTH_COOKIE_NAME = 'auth_token'; // Customer auth
const ADMIN_AUTH_COOKIE_NAME = 'admin_auth'; // Staff/Admin auth
// Inactivity tracking - separados por contexto para evitar resets cruzados
const LAST_ACTIVITY_ADMIN_COOKIE = 'last_activity_admin';
const LAST_ACTIVITY_USER_COOKIE = 'last_activity_user';

// Idle timeout configurável via env (default: 10 minutos)
// Aplicado APENAS para admin e clientes, NÃO para pontos de coleta e coletores autônomos
const SESSION_IDLE_MINUTES = parseInt(process.env.SESSION_IDLE_MINUTES || '10', 10);
const INACTIVITY_LIMIT_MS = SESSION_IDLE_MINUTES * 60 * 1000;

// Tipos de erro de verificação JWT
type JWTVerifyResult = { payload: AdminJWTPayload | JWTPayload | null; error: 'expired' | 'invalid' | null };

// User e StaffUser usam caches de sessão no Redis
// No in-memory caches needed - Redis is the source of truth


interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion?: number; // Adicionado para validação de revogação
  sid?: string; // Sessão do aparelho (tokens antigos não têm)
  iat?: number;
  exp?: number;
}

interface AdminJWTPayload {
  staffId: string;
  email: string;
  role: string;
  tokenVersion: number;
  sid?: string; // Sessão do aparelho (tokens antigos não têm)
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}



/**
 * Verify customer JWT token and return payload with error type
 */
async function verifyToken(token: string): Promise<{ payload: JWTPayload | null; error: 'expired' | 'invalid' | null }> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { payload: payload as unknown as JWTPayload, error: null };
  } catch (error) {
    // Detectar erro de token expirado especificamente
    if (error instanceof joseErrors.JWTExpired) {
      return { payload: null, error: 'expired' };
    }
    // Token invalid
    return { payload: null, error: 'invalid' };
  }
}

/**
 * Verify admin JWT token and return payload with error type
 */
async function verifyAdminToken(token: string): Promise<{ payload: AdminJWTPayload | null; error: 'expired' | 'invalid' | null }> {
  try {
    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET, {
      issuer: 'enviolegal-admin',
      audience: 'admin',
    });
    return { payload: payload as unknown as AdminJWTPayload, error: null };
  } catch (error) {
    // Detectar erro de token expirado especificamente
    if (error instanceof joseErrors.JWTExpired) {
      return { payload: null, error: 'expired' };
    }
    // Token invalid
    return { payload: null, error: 'invalid' };
  }
}



/**
 * Check if user has admin role
 */
function isAdmin(payload: JWTPayload | null): boolean {
  return payload?.role === 'admin';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated(payload: JWTPayload | null): boolean {
  return payload !== null;
}

/**
 * Check if staff user is authenticated
 */
function isStaffAuthenticated(payload: AdminJWTPayload | null): boolean {
  return payload !== null && payload.staffId !== undefined;
}

/**
 * Check if session has expired due to inactivity
 * Returns true if inactive for more than INACTIVITY_LIMIT_MS
 */
function isInactiveSession(lastActivityValue: string | undefined): boolean {
  if (!lastActivityValue) {
    // No activity recorded yet - not inactive
    return false;
  }

  const lastActivityTime = parseInt(lastActivityValue, 10);
  if (isNaN(lastActivityTime)) {
    // Invalid timestamp - treat as inactive for safety
    return true;
  }

  const now = Date.now();
  return (now - lastActivityTime) > INACTIVITY_LIMIT_MS;
}

/**
 * Validate user tokenVersion and status against Redis (fail-closed)
 * Returns true if valid, false if token should be rejected
 */
async function validateUserTokenVersion(
  userId: string,
  tokenVersion: number | undefined,
  sid?: string
): Promise<{ valid: boolean; reason?: string }> {
  // Se token não tem tokenVersion, consideramos válido por compatibilidade
  // (tokens antigos não tinham tokenVersion)
  if (tokenVersion === undefined) {
    return { valid: true };
  }

  try {
    // Verificar tokenVersion no Redis (fail-closed)
    const redisTokenVersion = await sessionCache.getTokenVersion(userId);

    // Cache miss = sessão não existe → 401
    if (redisTokenVersion === null) {
      return { valid: false, reason: 'session_not_found' };
    }

    // Mismatch = logout foi feito ou sessão inválida → 401
    if (redisTokenVersion !== tokenVersion) {
      return { valid: false, reason: 'token_revoked' };
    }

    // Logout neste aparelho: os outros aparelhos do usuário seguem logados.
    if (sid && !(await sessionCache.hasDevice(userId, sid))) {
      return { valid: false, reason: 'session_closed' };
    }

    // Verificar status na sessão Redis
    const session = await sessionCache.get(userId);
    if (!session) {
      return { valid: false, reason: 'session_not_found' };
    }

    if (session.status !== 'active') {
      return { valid: false, reason: 'user_blocked' };
    }

    return { valid: true };
  } catch (error) {
    console.error('[PROXY] Redis error validating user tokenVersion:', error);
    // On Redis error, reject for security (fail-closed)
    return { valid: false, reason: 'redis_error' };
  }
}



/**
 * Create response with updated last_activity cookie
 * @param activityCookieName - The activity cookie to update (admin or user)
 */
function createResponseWithActivityCookie(
  response: NextResponse,
  activityCookieName: string
): NextResponse {
  response.cookies.set(activityCookieName, Date.now().toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return response;
}

/**
 * Create redirect response that clears auth cookies (for inactivity timeout)
 * @param authCookieName - The auth cookie to clear (admin_auth or auth_token)
 * @param activityCookieName - The activity cookie to clear (admin or user)
 */
function createTimeoutRedirect(
  request: NextRequest,
  loginPath: string,
  returnParam: string,
  pathname: string,
  authCookieName: string,
  activityCookieName: string
): NextResponse {
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set(returnParam, pathname);
  loginUrl.searchParams.set('reason', 'inactivity'); // Indicate inactivity timeout
  const response = NextResponse.redirect(loginUrl);

  // Clear the auth cookie to force re-login
  response.cookies.delete(authCookieName);

  // Clear the last_activity cookie for this context
  response.cookies.delete(activityCookieName);

  return response;
}

/**
 * Create redirect response that clears auth cookies (for session/JWT expiration)
 * Different from inactivity - this is when the fixed JWT TTL expires
 * @param authCookieName - The auth cookie to clear (admin_auth or auth_token)
 * @param activityCookieName - The activity cookie to clear (admin or user)
 */
function createSessionExpiredRedirect(
  request: NextRequest,
  loginPath: string,
  returnParam: string,
  pathname: string,
  authCookieName: string,
  activityCookieName: string
): NextResponse {
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set(returnParam, pathname);
  loginUrl.searchParams.set('reason', 'session-expired'); // Indicate JWT expired
  const response = NextResponse.redirect(loginUrl);

  // Clear the auth cookie to force re-login
  response.cookies.delete(authCookieName);

  // Clear the last_activity cookie for this context
  response.cookies.delete(activityCookieName);

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is an admin route (starts with /admin or /api/admin)
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  // Skip middleware for admin login page and admin auth APIs
  if (pathname === '/admin/login' || pathname.startsWith('/api/admin/auth/')) {
    return NextResponse.next();
  }

  // Handle admin routes separately
  if (isAdminRoute) {
    // Get admin auth token from cookie
    const adminToken = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;

    // Verify token and check for specific error types
    const adminResult = adminToken ? await verifyAdminToken(adminToken) : { payload: null, error: null };

    // If JWT expired, redirect with session-expired reason and clear cookies
    if (adminResult.error === 'expired') {
      return createSessionExpiredRedirect(request, '/admin/login', 'next', pathname, ADMIN_AUTH_COOKIE_NAME, LAST_ACTIVITY_ADMIN_COOKIE);
    }

    if (!isStaffAuthenticated(adminResult.payload)) {
      // Not authenticated as staff - redirect to admin login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const adminPayload = adminResult.payload!;

    // Validate tokenVersion against Redis (fail-closed)
    try {
      const staffId = adminPayload.staffId;

      // Verificar tokenVersion no Redis (fail-closed)
      const redisTokenVersion = await staffSessionCache.getTokenVersion(staffId);

      // Cache miss = sessão não existe → redirect to login
      if (redisTokenVersion === null) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Mismatch = logout foi feito ou sessão inválida → redirect to login
      if (redisTokenVersion !== adminPayload.tokenVersion) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Logout neste aparelho → redirect to login (os outros seguem logados)
      if (adminPayload.sid && !(await staffSessionCache.hasDevice(staffId, adminPayload.sid))) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Verificar status na sessão Redis
      const session = await staffSessionCache.get(staffId);
      if (!session || session.status !== 'ACTIVE') {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch (error) {
      console.error('[PROXY] Redis error validating staff tokenVersion:', error);
      // On Redis error, redirect to login for security (fail-closed)
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check inactivity timeout for admin
    const adminLastActivity = request.cookies.get(LAST_ACTIVITY_ADMIN_COOKIE)?.value;
    if (isInactiveSession(adminLastActivity)) {
      // Session expired due to inactivity - redirect to admin login
      return createTimeoutRedirect(request, '/admin/login', 'next', pathname, ADMIN_AUTH_COOKIE_NAME, LAST_ACTIVITY_ADMIN_COOKIE);
    }

    // Is authenticated as staff with valid tokenVersion - update activity and allow access
    return createResponseWithActivityCookie(NextResponse.next(), LAST_ACTIVITY_ADMIN_COOKIE);
  }

  // Get route protection level for customer routes
  const protection = getRouteProtection(pathname);

  // If route is public, allow access
  if (!protection) {
    return NextResponse.next();
  }

  // Check if this is an API route
  const isApiRoute = pathname.startsWith('/api/');

  // Get auth token from cookie (customer auth)
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const tokenResult = token ? await verifyToken(token) : { payload: null, error: null };

  // If JWT expired, redirect with session-expired reason and clear cookies
  if (tokenResult.error === 'expired') {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Session expired', message: 'Sessão expirada. Faça login novamente.' },
        { status: 401 }
      );
    }
    return createSessionExpiredRedirect(request, '/auth/login', 'returnUrl', pathname, AUTH_COOKIE_NAME, LAST_ACTIVITY_USER_COOKIE);
  }

  const payload = tokenResult.payload;


  // Handle admin routes (customer with admin role)
  if (protection === 'admin') {
    if (!isAuthenticated(payload)) {
      if (isApiRoute) {
        // API route - return 401 Unauthorized
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }
      // Page route - redirect to login with returnUrl
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!isAdmin(payload)) {
      if (isApiRoute) {
        // API route - return 403 Forbidden
        return NextResponse.json(
          { error: 'Forbidden', message: 'Admin access required' },
          { status: 403 }
        );
      }
      // Page route - redirect to login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // SECURITY: Validate user tokenVersion and status against database
    const userAdminValidation = await validateUserTokenVersion(
      payload!.userId,
      payload!.tokenVersion,
      payload!.sid
    );

    if (!userAdminValidation.valid) {
      if (isApiRoute) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: userAdminValidation.reason === 'user_blocked'
              ? 'Conta bloqueada. Entre em contato com o suporte.'
              : 'Sessão inválida. Faça login novamente.',
            code: userAdminValidation.reason
          },
          { status: 401 }
        );
      }
      return createSessionExpiredRedirect(request, '/auth/login', 'returnUrl', pathname, AUTH_COOKIE_NAME, LAST_ACTIVITY_USER_COOKIE);
    }

    // Check inactivity timeout for customer admin
    const customerAdminLastActivity = request.cookies.get(LAST_ACTIVITY_USER_COOKIE)?.value;
    if (isInactiveSession(customerAdminLastActivity)) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'Session expired', message: 'Sessão expirada por inatividade' },
          { status: 401 }
        );
      }
      return createTimeoutRedirect(request, '/auth/login', 'returnUrl', pathname, AUTH_COOKIE_NAME, LAST_ACTIVITY_USER_COOKIE);
    }

    // Is admin - update activity and allow access
    return createResponseWithActivityCookie(NextResponse.next(), LAST_ACTIVITY_USER_COOKIE);
  }

  // Handle authenticated routes (any logged-in user)
  if (protection === 'auth') {
    if (!isAuthenticated(payload)) {
      if (isApiRoute) {
        // API route - return 401 Unauthorized
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }
      // Page route - redirect to login with returnUrl
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // SECURITY: Validate user tokenVersion and status against database
    const userValidation = await validateUserTokenVersion(
      payload!.userId,
      payload!.tokenVersion,
      payload!.sid
    );

    if (!userValidation.valid) {
      if (isApiRoute) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: userValidation.reason === 'user_blocked'
              ? 'Conta bloqueada. Entre em contato com o suporte.'
              : 'Sessão inválida. Faça login novamente.',
            code: userValidation.reason
          },
          { status: 401 }
        );
      }
      return createSessionExpiredRedirect(request, '/auth/login', 'returnUrl', pathname, AUTH_COOKIE_NAME, LAST_ACTIVITY_USER_COOKIE);
    }

    // Check inactivity timeout for authenticated users (cliente)
    const clienteLastActivity = request.cookies.get(LAST_ACTIVITY_USER_COOKIE)?.value;
    if (isInactiveSession(clienteLastActivity)) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'Session expired', message: 'Sessão expirada por inatividade' },
          { status: 401 }
        );
      }
      return createTimeoutRedirect(request, '/auth/login', 'returnUrl', pathname, AUTH_COOKIE_NAME, LAST_ACTIVITY_USER_COOKIE);
    }

    // Is authenticated - update activity and allow access
    return createResponseWithActivityCookie(NextResponse.next(), LAST_ACTIVITY_USER_COOKIE);
  }

  // Default: allow access
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

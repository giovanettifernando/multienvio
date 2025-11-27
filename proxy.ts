// Next.js 16 Proxy - replaces middleware.ts
// Runtime is always Node.js (not Edge) - Prisma works here

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getRouteProtection } from './lib/auth/route-protection';
import { prisma } from './lib/db';

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

// JWT Secrets (customer vs admin)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'envio-legal-secret-key-change-in-production'
);

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'admin-panel-secret-key-change-in-production'
);

// Cookie names
const AUTH_COOKIE_NAME = 'auth_token'; // Customer auth
const ADMIN_AUTH_COOKIE_NAME = 'admin_auth'; // Staff/Admin auth
const LAST_ACTIVITY_COOKIE_NAME = 'last_activity'; // Inactivity tracking

// Inactivity timeout (10 minutes)
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;

// Cache de tokenVersion (30 segundos) para reduzir DB lookups
interface TokenVersionCache {
  tokenVersion: number;
  status: string;
  cachedAt: number;
}
const tokenVersionCache = new Map<string, TokenVersionCache>();
const TOKEN_VERSION_CACHE_TTL = 30 * 1000; // 30 segundos

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface AdminJWTPayload {
  staffId: string;
  email: string;
  role: string;
  tokenVersion: number;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify customer JWT token and return payload
 */
async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch (error) {
    // Token invalid or expired
    return null;
  }
}

/**
 * Verify admin JWT token and return payload
 */
async function verifyAdminToken(token: string): Promise<AdminJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET, {
      issuer: 'enviolegal-admin',
      audience: 'admin',
    });
    return payload as unknown as AdminJWTPayload;
  } catch (error) {
    // Token invalid or expired
    return null;
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
 * Create response with updated last_activity cookie
 */
function createResponseWithActivityCookie(response: NextResponse): NextResponse {
  response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, Date.now().toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return response;
}

/**
 * Create redirect response that clears auth cookies (for timeout)
 */
function createTimeoutRedirect(request: NextRequest, loginPath: string, returnParam: string, pathname: string): NextResponse {
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set(returnParam, pathname);
  const response = NextResponse.redirect(loginUrl);

  // Clear the last_activity cookie
  response.cookies.delete(LAST_ACTIVITY_COOKIE_NAME);

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
    const adminPayload = adminToken ? await verifyAdminToken(adminToken) : null;

    if (!isStaffAuthenticated(adminPayload)) {
      // Not authenticated as staff - redirect to admin login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Validate tokenVersion against database (with cache)
    try {
      const staffId = adminPayload!.staffId;
      const now = Date.now();

      // Verificar cache primeiro
      const cached = tokenVersionCache.get(staffId);
      let staffUser: { tokenVersion: number; status: string } | null = null;

      if (cached && (now - cached.cachedAt) < TOKEN_VERSION_CACHE_TTL) {
        // Usar cache
        staffUser = { tokenVersion: cached.tokenVersion, status: cached.status };
      } else {
        // Buscar no banco de dados
        const dbStaffUser = await prisma.staffUser.findUnique({
          where: { id: staffId },
          select: { tokenVersion: true, status: true },
        });

        if (dbStaffUser) {
          staffUser = dbStaffUser;
          // Atualizar cache
          tokenVersionCache.set(staffId, {
            tokenVersion: dbStaffUser.tokenVersion,
            status: dbStaffUser.status,
            cachedAt: now,
          });
        }
      }

      // If user not found, tokenVersion mismatch, or user is not active, redirect to login
      if (
        !staffUser ||
        staffUser.tokenVersion !== adminPayload!.tokenVersion ||
        staffUser.status !== 'ACTIVE'
      ) {
        // Invalidar cache em caso de erro de autenticação
        tokenVersionCache.delete(staffId);
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch (error) {
      console.error('[PROXY] Database error validating tokenVersion:', error);
      // On database error, redirect to login for security
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check inactivity timeout for admin
    const adminLastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE_NAME)?.value;
    if (isInactiveSession(adminLastActivity)) {
      // Session expired due to inactivity - redirect to admin login
      return createTimeoutRedirect(request, '/admin/login', 'next', pathname);
    }

    // Is authenticated as staff with valid tokenVersion - update activity and allow access
    return createResponseWithActivityCookie(NextResponse.next());
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
  const payload = token ? await verifyToken(token) : null;

  // Handle collector routes
  if (protection === 'collector') {
    // TODO: Implement collector authentication
    // For now, collectors use their own auth system in their routes
    // This middleware just ensures the route is recognized as protected
    return NextResponse.next();
  }

  // Handle pickup point routes
  if (protection === 'pickup_point') {
    // TODO: Implement pickup point authentication
    // For now, pickup points use their own auth system in their routes
    // This middleware just ensures the route is recognized as protected
    return NextResponse.next();
  }

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

    // Check inactivity timeout for customer admin
    const customerAdminLastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE_NAME)?.value;
    if (isInactiveSession(customerAdminLastActivity)) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'Session expired', message: 'Sessão expirada por inatividade' },
          { status: 401 }
        );
      }
      return createTimeoutRedirect(request, '/login', 'returnUrl', pathname);
    }

    // Is admin - update activity and allow access
    return createResponseWithActivityCookie(NextResponse.next());
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

    // Check inactivity timeout for authenticated users (cliente)
    const clienteLastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE_NAME)?.value;
    if (isInactiveSession(clienteLastActivity)) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'Session expired', message: 'Sessão expirada por inatividade' },
          { status: 401 }
        );
      }
      return createTimeoutRedirect(request, '/login', 'returnUrl', pathname);
    }

    // Is authenticated - update activity and allow access
    return createResponseWithActivityCookie(NextResponse.next());
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

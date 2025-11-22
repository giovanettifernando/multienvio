import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getRouteProtection } from '@/lib/auth/route-protection';
import { prisma } from '@/lib/db';

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is an admin route (starts with /admin)
  const isAdminRoute = pathname.startsWith('/admin');

  // Skip middleware for admin login page
  if (pathname === '/admin/login') {
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

    // Validate tokenVersion against database
    try {
      const staffUser = await prisma.staffUser.findUnique({
        where: { id: adminPayload!.staffId },
        select: { tokenVersion: true, status: true },
      });

      // If user not found, tokenVersion mismatch, or user is not active, redirect to login
      if (
        !staffUser ||
        staffUser.tokenVersion !== adminPayload!.tokenVersion ||
        staffUser.status !== 'ACTIVE'
      ) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch (error) {
      console.error('[MIDDLEWARE] Database error validating tokenVersion:', error);
      // On database error, redirect to login for security
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Is authenticated as staff with valid tokenVersion - allow access
    return NextResponse.next();
  }

  // Get route protection level for customer routes
  const protection = getRouteProtection(pathname);

  // If route is public, allow access
  if (!protection) {
    return NextResponse.next();
  }

  // Get auth token from cookie (customer auth)
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;

  // Handle admin routes (customer with admin role)
  if (protection === 'admin') {
    if (!isAuthenticated(payload)) {
      // Not authenticated - redirect to login with returnUrl
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!isAdmin(payload)) {
      // Authenticated but not admin - redirect to login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Is admin - allow access
    return NextResponse.next();
  }

  // Handle authenticated routes (any logged-in user)
  if (protection === 'auth') {
    if (!isAuthenticated(payload)) {
      // Not authenticated - redirect to login with returnUrl
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Is authenticated - allow access
    return NextResponse.next();
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

/**
 * Route protection helpers for middleware
 * Defines which routes require authentication or admin access
 */

/**
 * Routes that require admin role
 */
const ADMIN_ROUTES = [
  '/admin',
  '/admin/*',
];

/**
 * Routes that require authentication (any logged-in user)
 */
const AUTH_ROUTES = [
  '/conta',
  '/minha-conta',
  '/pedidos',
  '/coletas',
  '/envios',
];

/**
 * Public routes that don't require authentication
 * These are regex patterns
 */
const PUBLIC_ROUTES = [
  /^\/$/,                          // Home
  /^\/auth\/.*/,                   // All auth pages (login, register, etc)
  /^\/api\/auth\/.*/,              // Auth API endpoints (login, register, logout, me)
  /^\/_next\/.*/,                  // Next.js internals
  /^\/public\/.*/,                 // Public assets
  /^\/assets\/.*/,                 // Assets
  /^\/favicon\..*/,                // Favicon
  /^\/robots\.txt$/,               // Robots
  /^\/sitemap\.xml$/,              // Sitemap
  /^\/api\/public\/.*/,            // Public API endpoints
];

/**
 * Check if a path requires admin access
 */
export function isAdminRoute(path: string): boolean {
  return ADMIN_ROUTES.some(route => {
    if (route.endsWith('/*')) {
      const baseRoute = route.slice(0, -2);
      return path === baseRoute || path.startsWith(baseRoute + '/');
    }
    return path === route;
  });
}

/**
 * Check if a path requires authentication
 */
export function isAuthRoute(path: string): boolean {
  return AUTH_ROUTES.some(route => {
    if (route.endsWith('/*')) {
      const baseRoute = route.slice(0, -2);
      return path === baseRoute || path.startsWith(baseRoute + '/');
    }
    return path === route;
  });
}

/**
 * Check if a path is public (doesn't require authentication)
 */
export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(pattern => pattern.test(path));
}

/**
 * Check if the path should be protected by middleware
 * Returns the type of protection needed: 'admin', 'auth', or null (public)
 */
export function getRouteProtection(path: string): 'admin' | 'auth' | null {
  // Check public routes first
  if (isPublicRoute(path)) {
    return null;
  }

  // Check admin routes
  if (isAdminRoute(path)) {
    return 'admin';
  }

  // Check auth routes
  if (isAuthRoute(path)) {
    return 'auth';
  }

  // Default to public
  return null;
}

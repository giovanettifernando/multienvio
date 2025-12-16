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
 * Use /* suffix to match sub-routes
 */
const AUTH_ROUTES = [
  '/conta',
  '/conta/*',
  '/minha-conta',
  '/minha-conta/*',
  '/pedidos',
  '/pedidos/*',
  '/coletas',
  '/coletas/*',
  '/envios',
  '/envios/*',
  '/cotacoes',
  '/cotacoes/*',
  '/cotar',
  '/cotar/*',
  '/etiquetas',
  '/etiquetas/*',
  '/shipments',
  '/shipments/*',
  '/carrinho',
  '/carrinho/*',
  '/suporte',
  '/suporte/*',
  '/carteira',
  '/carteira/*',
  '/rastreamento',
  '/rastreamento/*',
];

/**
 * Public routes that don't require authentication
 * These are regex patterns
 */
const PUBLIC_ROUTES = [
  /^\/$/,                          // Home
  /^\/auth\/.*/,                   // All auth pages (login, register, etc)
  /^\/api\/auth\/.*/,              // Auth API endpoints (login, register, logout, me)
  /^\/api\/admin\/auth\/.*/,       // Admin auth API endpoints (login, logout, me)
  /^\/_next\/.*/,                  // Next.js internals
  /^\/public\/.*/,                 // Public assets
  /^\/assets\/.*/,                 // Assets
  /^\/favicon\..*/,                // Favicon
  /^\/robots\.txt$/,               // Robots
  /^\/sitemap\.xml$/,              // Sitemap
  /^\/api\/public\/.*/,            // Public API endpoints
  /^\/api\/webhooks\/.*/,          // External webhooks (MP, tracking, etc)
  /^\/api\/health.*/,              // Health check endpoints
  /^\/api\/cep.*/,                 // CEP lookup (public)
  /^\/api\/system\/status$/,       // System status (public)
  /^\/api\/recipient-payment\/[^/]+$/, // Recipient payment by token (public - destinatário paga frete)
  /^\/api\/recipient-payment\/pay$/,   // Process recipient payment (public)
  /^\/api\/recipient-payment\/create-payment$/, // Create MercadoPago payment for recipient (public)
  /^\/api\/recipient-payment\/refresh-status$/, // Refresh PIX status for recipient payment (public)
  /^\/api\/payments\/mercadopago\/public-key$/, // MercadoPago public key (public - safe to expose)
  /^\/pagar\/.*/,                  // Payment page for recipients (public)
];

/**
 * API routes that require admin authentication (staff)
 * These are handled separately in middleware (admin_auth cookie)
 */
const ADMIN_API_ROUTES = [
  /^\/api\/admin\/.*/,             // All admin API endpoints
];

/**
 * API routes that require collector authentication
 */
const COLLECTOR_API_ROUTES = [
  /^\/api\/coletores\/.*/,         // Collector system
];

/**
 * API routes that require pickup point authentication
 */
const PICKUP_POINT_API_ROUTES = [
  /^\/api\/pontos-coleta\/.*/,     // Pickup point system
];

/**
 * API routes that require regular user authentication
 */
const AUTH_API_ROUTES = [
  /^\/api\/account\/.*/,           // Account management
  /^\/api\/wallet\/.*/,            // Digital wallet
  /^\/api\/shipments\/.*/,         // Shipments
  /^\/api\/cotacoes\/.*/,          // Quotes
  /^\/api\/coletas\/.*/,           // Pickups
  /^\/api\/orders\/.*/,            // Orders
  /^\/api\/cart.*/,                // Shopping cart
  /^\/api\/carrinho.*/,            // Shopping cart (PT)
  /^\/api\/checkout.*/,            // Checkout
  /^\/api\/payments\/.*/,          // Payments
  /^\/api\/support\/.*/,           // Support tickets
  /^\/api\/recurring-items\/.*/,   // Recurring items
  /^\/api\/user\/.*/,              // User preferences
  /^\/api\/pickups\/.*/,           // Pickup management
  /^\/api\/labels.*/,              // Label generation
  /^\/api\/invoices.*/,            // Invoices
  /^\/api\/packaging.*/,           // Packaging
  /^\/api\/nfe\/.*/,               // NFe parsing
  /^\/api\/dashboard.*/,           // Dashboard data
  /^\/api\/tracking.*/,            // Tracking (auth required)
  /^\/api\/services.*/,            // Shipping services
  /^\/api\/units.*/,               // Units
  /^\/api\/pickup-fee\/.*/,        // Pickup fee calculation
  /^\/api\/pickup-points.*/,       // Pickup points lookup
  /^\/api\/cards.*/,               // Saved cards
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
 * Check if API route requires admin authentication
 */
export function isAdminApiRoute(path: string): boolean {
  return ADMIN_API_ROUTES.some(pattern => pattern.test(path));
}

/**
 * Check if API route requires collector authentication
 */
export function isCollectorApiRoute(path: string): boolean {
  return COLLECTOR_API_ROUTES.some(pattern => pattern.test(path));
}

/**
 * Check if API route requires pickup point authentication
 */
export function isPickupPointApiRoute(path: string): boolean {
  return PICKUP_POINT_API_ROUTES.some(pattern => pattern.test(path));
}

/**
 * Check if API route requires regular user authentication
 */
export function isAuthApiRoute(path: string): boolean {
  return AUTH_API_ROUTES.some(pattern => pattern.test(path));
}

/**
 * Check if the path should be protected by middleware
 * Returns the type of protection needed: 'admin', 'auth', 'collector', 'pickup_point', or null (public)
 *
 * SECURITY: All /api/* routes require authentication by default unless explicitly public
 */
export function getRouteProtection(path: string): 'admin' | 'auth' | 'collector' | 'pickup_point' | null {
  // Check public routes first
  if (isPublicRoute(path)) {
    return null;
  }

  // Check admin routes (both pages and API)
  if (isAdminRoute(path) || isAdminApiRoute(path)) {
    return 'admin';
  }

  // Check collector routes
  if (isCollectorApiRoute(path)) {
    return 'collector';
  }

  // Check pickup point routes
  if (isPickupPointApiRoute(path)) {
    return 'pickup_point';
  }

  // Check auth routes (both pages and API)
  if (isAuthRoute(path) || isAuthApiRoute(path)) {
    return 'auth';
  }

  // SECURITY: All API routes require authentication by default
  // This is a defense-in-depth measure - if a route is not explicitly public, it requires auth
  if (path.startsWith('/api/')) {
    console.warn(`[SECURITY] API route not explicitly configured, requiring auth: ${path}`);
    return 'auth';
  }

  // Default to public for non-API routes (pages)
  return null;
}

import type { NextConfig } from "next";

// Bundle analyzer é opcional - só carrega se ANALYZE=true e o pacote estiver instalado
let withBundleAnalyzer = (config: NextConfig) => config;
if (process.env.ANALYZE === "true") {
  try {
    const bundleAnalyzer = require("@next/bundle-analyzer");
    withBundleAnalyzer = bundleAnalyzer({ enabled: true });
  } catch {
    console.warn("@next/bundle-analyzer not installed, skipping...");
  }
}

const nextConfig: NextConfig = {
  // Standalone output disabled temporarily due to _data/postgres permission issues
  // Re-enable after moving postgres data outside project or using named Docker volume
  // output: 'standalone',

  // Skip trailing slash to avoid 404 generation issues
  skipTrailingSlashRedirect: true,

  // Transpile Ant Design packages
  transpilePackages: ['antd', '@ant-design', 'rc-util', 'rc-pagination', 'rc-picker'],

  // Server-only packages - prevent bundling with Turbopack
  // pino/thread-stream have test files that break Turbopack
  serverExternalPackages: ['pino', 'thread-stream', 'pino-pretty'],

  // Cache Components temporarily disabled - Math.random() issues with Ant Design
  // TODO: Re-enable after proper configuration of all pages with Ant Design
  // cacheComponents: true,

  // Experimental: optimize package imports (replaces modularizeImports for Turbopack)
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
    // Increase body size limit for file uploads through proxy
    proxyClientMaxBodySize: '20mb',
  },

  // Note: modularizeImports removed - conflicts with Turbopack in Next.js 16
  // optimizePackageImports handles this automatically

  async rewrites() {
    return [
      // Servir uploads via API route (Next.js não serve arquivos estáticos após build)
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },

  async redirects() {
    return [
      // Redirects temporários (podem ser alterados no futuro)
      {
        source: "/pedidos",
        destination: "/shipments",
        permanent: false,
      },
      {
        source: "/onboarding",
        destination: "/minha-conta",
        permanent: false,
      },
      {
        source: "/onboarding/:path*",
        destination: "/minha-conta",
        permanent: false,
      },
    ];
  },

  // Configurações de otimização
  reactStrictMode: true,

  // Desabilitar x-powered-by header por segurança
  poweredByHeader: false,

  // SECURITY: Headers de segurança
  async headers() {
    // CSP directives - configuração para desenvolvimento e produção
    const isDev = process.env.NODE_ENV === 'development';
    const cspDirectives = [
      // Base policies
      "default-src 'self'",
      // Scripts: self + inline para React/Next.js + eval em dev para HMR
      // Pagar.me: checkout.pagar.me (TokenizeCard.js)
      `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://checkout.pagar.me https://www.googletagmanager.com https://www.google-analytics.com`,
      // Styles: self + inline para Ant Design CSS-in-JS
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: self + data URIs (para base64) + CDNs comuns
      "img-src 'self' data: blob: https: http:",
      // Fonts: self + Google Fonts
      "font-src 'self' https://fonts.gstatic.com data:",
      // Conexões: self + APIs externas
      // Pagar.me: api.pagar.me (produção) + sdx-api.pagar.me (sandbox)
      "connect-src 'self' https://api.pagar.me https://sdx-api.pagar.me https://api.correios.com.br https://apihom.correios.com.br https://viacep.com.br wss: ws:",
      // Frames: blob: para PDFs em iframe
      "frame-src 'self' blob:",
      // Form actions: self
      "form-action 'self'",
      // Base URI: self
      "base-uri 'self'",
      // Object/embed: none (segurança)
      "object-src 'none'",
      // Upgrade insecure requests em produção
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].filter(Boolean).join('; ');

    return [
      {
        // Aplicar a todas as rotas
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // SECURITY: Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
        ],
      },
      {
        // CORS para API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.CORS_ORIGIN || 'https://enviolegal.com.br',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },

  // Aumentar timeout para geração de páginas estáticas
  staticPageGenerationTimeout: 180,

  // Ignorar erros de build nas páginas de erro (workaround para bug do AntD Registry)
  typescript: {
    ignoreBuildErrors: false,
  },
  // Note: eslint config removed - no longer supported in next.config.ts (Next.js 16)
  // Use ESLint CLI directly: `eslint .`
};

export default withBundleAnalyzer(nextConfig);

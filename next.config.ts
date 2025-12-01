import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Standalone output disabled temporarily due to _data/postgres permission issues
  // Re-enable after moving postgres data outside project or using named Docker volume
  // output: 'standalone',

  // Skip trailing slash to avoid 404 generation issues
  skipTrailingSlashRedirect: true,

  // Transpile Ant Design packages
  transpilePackages: ['antd', '@ant-design', 'rc-util', 'rc-pagination', 'rc-picker'],

  // Experimental: optimize package imports (replaces modularizeImports for Turbopack)
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
    // Increase body size limit for file uploads through proxy
    proxyClientMaxBodySize: '20mb',
    // Note: cacheComponents (PPR) requires migration from 'dynamic'/'revalidate' configs
    // to 'use cache' directive. Enable after full migration.
    // cacheComponents: true,
  },

  // Note: modularizeImports removed - conflicts with Turbopack in Next.js 16
  // optimizePackageImports handles this automatically

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

import type { NextConfig } from "next";

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

  // Aumentar timeout para geração de páginas estáticas
  staticPageGenerationTimeout: 180,

  // Ignorar erros de build nas páginas de erro (workaround para bug do AntD Registry)
  typescript: {
    ignoreBuildErrors: false,
  },
  // Note: eslint config removed - no longer supported in next.config.ts (Next.js 16)
  // Use ESLint CLI directly: `eslint .`
};

export default nextConfig;

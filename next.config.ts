import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Revert to standalone output
  output: 'standalone',

  // Skip trailing slash to avoid 404 generation issues
  skipTrailingSlashRedirect: true,

  // Transpile Ant Design packages
  transpilePackages: ['antd', '@ant-design', 'rc-util', 'rc-pagination', 'rc-picker'],

  // Experimental: optimize package imports
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },

  modularizeImports: {
    antd: {
      transform: "antd/es/{{member}}",
    },
    "@ant-design/icons": {
      transform: "@ant-design/icons/{{member}}",
    },
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

  // Aumentar timeout para geração de páginas estáticas
  staticPageGenerationTimeout: 180,

  // Ignorar erros de build nas páginas de erro (workaround para bug do AntD Registry)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desabilitar geração estática para evitar bug do AntD Registry com Next.js 15
  output: 'standalone',

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

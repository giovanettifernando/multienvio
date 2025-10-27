import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;

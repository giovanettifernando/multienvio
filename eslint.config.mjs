import { dirname } from "path";
import { fileURLToPath } from "url";
import nextConfig from "eslint-config-next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "_data/**",
      "_infra/**",
      "next-env.d.ts",
    ],
  },
  {
    // TODO: Corrigir esses padrões gradualmente e remover essas desativações
    // Esses erros são do React Compiler (Next.js 16) que é mais rigoroso
    rules: {
      "react-hooks/set-state-in-effect": "warn", // Era error, mudar para warn temporariamente
    },
  },
  // Regra para prevenir uso de console.log em API routes
  // Use o logger estruturado: import { logger } from '@/lib/logger'
  {
    files: ["app/api/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
];

export default eslintConfig;

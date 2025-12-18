import nextConfig from "eslint-config-next";

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
      // Ignorar compat layers (serão removidos)
      "lib/**",
      "components/**",
      "store/**",
      "stores/**",
      "types/**",
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
  // Use o logger estruturado: import { logger } from '@/platform/logging/logger'
  {
    files: ["app/api/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // ============================================================================
  // BOUNDARY RULES - Deprecar imports legados
  // ============================================================================
  {
    files: ["app/**/*.ts", "app/**/*.tsx", "modules/**/*.ts", "modules/**/*.tsx", "shared/**/*.ts", "shared/**/*.tsx", "platform/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/lib/*"],
              message: "Import legado. Use @/modules/*, @/shared/* ou @/platform/* em vez de @/lib/*",
            },
            {
              group: ["@/components/*"],
              message: "Import legado. Use @/modules/*/ui/components ou @/shared/ui em vez de @/components/*",
            },
            {
              group: ["@/store/*", "@/stores/*"],
              message: "Import legado. Use @/modules/*/ui/state em vez de @/store(s)/*",
            },
            {
              group: ["@/types/*", "@/types"],
              message: "Import legado. Use @/shared/types em vez de @/types/*",
            },
          ],
        },
      ],
    },
  },
  // Impedir UI (React) de importar database diretamente
  {
    files: ["app/**/*.tsx", "modules/**/ui/**/*.tsx", "modules/**/ui/**/*.ts", "shared/ui/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/platform/db/*", "@/platform/db"],
              message: "UI não deve importar database diretamente. Use hooks ou services em @/modules/*/application",
            },
            {
              group: ["@prisma/client"],
              message: "UI não deve importar Prisma diretamente. Use hooks ou services.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;

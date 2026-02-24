# Stack and Runtime Inventory

## Runtimes and scripts
- Node engine: required node >=24.0.0.
  Evidence: package.json:5-7 "node": ">=24.0.0"
- Dev/build/run scripts: next dev --webpack, next dev (turbopack), next build, next start, eslint ., node --test, playwright, prisma CLI.
  Evidence: package.json:9-31 "dev", "dev:turbo", "build", "start", "lint", "test", "test:e2e", "db:*"
- Postinstall and git hooks: prisma generate, husky.
  Evidence: package.json:30-31 "postinstall", "prepare"

## Frameworks and core libs
- Next.js app router: next ^16.0.4.
  Evidence: package.json:60 "next": "^16.0.4"
- React 19: react ^19.2.0, react-dom ^19.2.0.
  Evidence: package.json:68-70
- TypeScript ^5, with tsconfig path aliases for @/ and moduleResolution=bundler.
  Evidence: package.json:97 "typescript": "^5"; tsconfig.json:2-31

## UI and frontend stack
- Ant Design 6 with Next registry and icons.
  Evidence: package.json:34-35, 47
- Shared UI wrappers exported from shared/ui.
  Evidence: shared/ui/index.ts:1-56
- Theme tokens and ConfigProvider are centralized in shared/ui/theme.ts and shared/ui/ELConfigProvider.tsx.
  Evidence: shared/ui/theme.ts:1-165; shared/ui/ELConfigProvider.tsx:1-11

## Data, cache, and infra libs
- Prisma 7 with @prisma/client and @prisma/adapter-pg plus pg driver.
  Evidence: package.json:38-39, 63
- Redis client via ioredis.
  Evidence: package.json:54
- Server-only enforcement for server modules.
  Evidence: package.json:74 "server-only": "^0.0.1"

## Auth, crypto, logging, and utilities
- JWT: jose ^6.1.0.
  Evidence: package.json:55
- Password hashing: bcrypt ^6.0.0.
  Evidence: package.json:48
- Logging: pino, pino-pretty, pino-roll.
  Evidence: package.json:64-66
- PDF and barcode: pdf-lib, jspdf, bwip-js, puppeteer.
  Evidence: package.json:49, 56, 62, 67
- Dates: date-fns, dayjs.
  Evidence: package.json:50-51

## Next config (build/runtime behavior)
- Transpile AntD packages; serverExternalPackages for pino/thread-stream; optimizePackageImports for antd and icons; proxyClientMaxBodySize 20mb; rewrites for /uploads; redirects; security headers; CORS for /api.
  Evidence: next.config.ts:22-38, 43-71, 80-167
- React strict mode enabled; poweredByHeader disabled.
  Evidence: next.config.ts:75-79

## TypeScript config
- baseUrl and path aliases for @/, @/modules, @/shared, @/platform.
  Evidence: tsconfig.json:2-31
- test tsconfig overrides module resolution and module to commonjs.
  Evidence: tsconfig.test.json:1-11

## Linting rules
- ESLint config blocks console.log in app/api and restricts legacy import paths; UI cannot import DB or Prisma.
  Evidence: eslint.config.mjs:29-36, 40-88

## Testing setup
- Node test runner via node --test and ts-node register (tests/register.js).
  Evidence: package.json:15-21; tests/register.js:1-48
- Playwright e2e config (desktop + mobile, webServer uses npm run dev).
  Evidence: playwright.config.ts:1-35
- Vitest config exists (globals, node env, tests/**/*.test.ts), but scripts use node --test.
  Evidence: vitest.config.ts:1-16; package.json:15-21

## CI workflow
- Forms inventory audit workflow uses Node 20 and runs npm run audit:forms.
  Evidence: .github/workflows/forms-inventory.yml:15-25

## Prisma CLI config
- prisma.config.ts points to prisma/schema.prisma and uses DATABASE_URL.
  Evidence: prisma.config.ts:4-11

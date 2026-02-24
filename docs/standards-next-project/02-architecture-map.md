# Architecture Inventory and Map

## Folder map and responsibilities
| Path | Responsibility | Evidence |
| --- | --- | --- |
| app/ | Next.js App Router entry, root layout, route groups | app/layout.tsx:1-39
| app/(envio)/ | Client app (sender) layout with dynamic client shell | app/(envio)/layout.tsx:1-14
| app/(admin)/admin/ | Admin client shell + permissions | app/(admin)/admin/layout.tsx:1-203
| app/(auth)/ | Auth UI route group | app/(auth)/layout.tsx:1-25
| app/(collector)/collector/ | Collector UI route group | app/(collector)/collector/layout.tsx:1-25
| app/(public)/ | Public pages (payment, collectors) | app/(public)/pagar/layout.tsx:1-12; app/(public)/coletores/layout.tsx:1-25
| app/api/ | API routes (route.ts handlers) | app/api/shipments/route.ts:7-28
| modules/*/application | Domain services / use cases | modules/shipments/application/list.service.ts:1-106
| modules/*/domain | Placeholder domain folders exist; no files found in shipments domain | docs/standards-next-project/repo-layout.md:1-200
| modules/*/dto | Input schemas / DTOs | modules/auth/dto/auth.ts:1-127
| modules/*/ui | UI components + hooks for each domain | modules/shipments/ui/components/RouteModeTag.tsx:1-23
| platform/ | Infra: API wrappers, cache, db, integrations, auth, logging, storage, crypto | platform/api/handler.ts:1-218; platform/cache/cache.ts:1-1468; platform/db/db.ts:1-205
| shared/ | Cross-cutting UI, types, validation, utils | shared/ui/index.ts:1-56; shared/types/contracts.ts:1-277; shared/validation/auth.ts:1

Note: modules/shipments/domain exists but is empty in the repo snapshot (see docs/standards-next-project/repo-layout.md).

## Runtime entry points
- Root layout and providers: AntdRegistry + ConfigProvider + AppProviders.
  Evidence: app/layout.tsx:1-39
- Client-side providers (React Query + App):
  Evidence: shared/ui/providers/app-providers.tsx:1-104
- Next.js instrumentation for background jobs:
  Evidence: instrumentation.ts:1-19
- Proxy layer for route protection (middleware replacement in Next 16):
  Evidence: proxy.ts:1-4
- API entry points are app/api/**/route.ts files (see route-inventory.md).
  Evidence: docs/standards-next-project/route-inventory.md

## Mermaid overview
```mermaid
graph TD
  Browser[Browser] --> AppRouter[Next App Router (app/)]
  AppRouter --> Layouts[Route group layouts]
  Layouts --> UI[Client UI + shared/ui wrappers]
  AppRouter --> ApiRoutes[app/api route handlers]

  ApiRoutes --> ApiWrapper[withApiHandler / withApiHandlerResponse]
  ApiWrapper --> ModulesApp[modules/*/application services]
  ModulesApp --> PlatformDB[platform/db Prisma]
  ModulesApp --> PlatformCache[platform/cache Redis helpers]
  ModulesApp --> PlatformIntegrations[platform/integrations]

  PlatformCache --> Redis[(Redis)]
  PlatformDB --> Postgres[(Postgres)]
  PlatformIntegrations --> External[External APIs: Correios, Mercado Pago, etc]
```

## Communication patterns
- UI uses shared/ui wrappers and feature modules; route groups are separated by layout boundaries.
  Evidence: shared/ui/index.ts:1-56; app/(envio)/layout.tsx:1-14; app/(admin)/admin/layout.tsx:1-203
- API routes call domain services in modules/*/application and use platform/* for infra (db, cache, auth, logging).
  Evidence: app/api/shipments/route.ts:7-26; modules/shipments/application/list.service.ts:13-106; platform/db/db.ts:1-205; platform/cache/cache.ts:1-147

## Server/client boundaries
- Server-only guards used in infra modules (db, cache, crypto, auth token services).
  Evidence: platform/db/db.ts:1; platform/cache/redis.ts:1; platform/crypto/card-vault.ts:1; modules/auth/application/jwt-tokens.ts:1
- Client layouts explicitly use "use client" where required (admin, auth, collector).
  Evidence: app/(admin)/admin/layout.tsx:15; app/(auth)/layout.tsx:1; app/(collector)/collector/layout.tsx:1

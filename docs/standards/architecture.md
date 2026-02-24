# Architecture - Envio Legal

Este apendice detalha a arquitetura atual com base no codigo.

## 1) Macro-arquitetura
- **App Router** segmentado por areas de produto (`admin`, `envio`, `auth`, `collector`, `public`). Evidencias: `app/(admin)`, `app/(envio)`, `app/(auth)`, `app/(collector)`, `app/(public)`.
- **Camadas por modulo**: `api`, `application`, `domain`, `infra`, `dto`, `ui`. Evidencias: `modules/shipments/*`, `modules/payments/*`, `modules/wallet/*`.
- **Infra centralizada** em `platform/**` (auth/cache/db/logging/integrations). Evidencias: `platform/auth/*`, `platform/cache/*`, `platform/db/*`, `platform/logging/*`, `platform/integrations/*`.

## 2) Navegacao por area

### Admin
- Rotas e layout em `app/(admin)`. Evidencia: `app/(admin)/admin/layout.tsx`.
- Permissoes por item de menu. Evidencia: `modules/admin/application/nav.ts`.
- Sessao admin gerenciada no client + verificacao server via `/api/admin/auth/me`. Evidencias: `app/(admin)/admin/layout.tsx`, `app/api/admin/auth/me/route.ts`.

### Envio (cliente)
- Layout client com verificacao de sessao pos-hidratacao. Evidencia: `app/(envio)/EnvioLayoutClient.tsx`.
- Shell padrao: `DashboardShell` (sidebar, responsividade). Evidencia: `shared/ui/layout/dashboard-shell.tsx`.

### Auth
- UI em `app/(auth)/*`, API em `app/api/auth/*`. Evidencias: `app/(auth)/auth/*`, `app/api/auth/*`.

### Collector / Ponto de coleta
- Paginas publicas e autenticadas em `app/(collector)` e `app/(public)/coletores`. Evidencias: `app/(collector)/collector/*`, `app/(public)/coletores/*`.
- APIs dedicadas em `/api/coletores` e `/api/pontos-coleta`. Evidencias: `app/api/coletores/*`, `app/api/pontos-coleta/*`.

## 3) API Layer e Handlers
- Envelope padrao e logging: `withApiHandler` em todas as rotas JSON. Evidencia: `platform/api/handler.ts`.
- Rotas que precisam de cookies/binary usam `withApiHandlerResponse`. Evidencia: `platform/api/handler.ts`.
- Erros padronizados via `ApiError` e `toApiError`. Evidencia: `platform/api/errors.ts`.

## 4) Domain Layer e Services
- Logica de dominio fica em `modules/*/application/*`. Evidencias: `modules/cart/application/*`, `modules/shipments/application/*`.
- Integracoes externas isoladas em `platform/integrations/*`. Evidencias: `platform/integrations/correios/*`, `platform/integrations/mercadopago/*`, `platform/integrations/openrouter/*`.

## 5) State machines e status
- **ShipmentStatus** (modelo oficial) com fases, labels e cores. Evidencia: `modules/shipments/application/shipment-status.ts`.
- **Matriz de transicoes** para tracking/ops. Evidencia: `modules/shipments/application/status-migration.ts`.
- **Auditoria de mudancas de status** (DB + logs). Evidencia: `modules/shipments/application/shipment-audit.ts`.
- **Enum legado em `shared/types/contracts.ts`** (INCONSISTENTE). Evidencia: `shared/types/contracts.ts`.

## 6) SSR/RSC boundaries
- `server-only` em modulos de infra para evitar uso no client. Evidencias: `platform/db/db.ts`, `platform/cache/redis.ts`, `platform/crypto/card-vault.ts`.
- Client components explicitos em layouts e providers. Evidencias: `app/(envio)/EnvioLayoutClient.tsx`, `shared/ui/providers/app-providers.tsx`.

## 7) Background jobs
- Jobs iniciados via `instrumentation.ts` com runtime Node. Evidencia: `instrumentation.ts`.

## 8) Configuracao de runtime e proxy
- `proxy.ts` substitui middleware e centraliza auth/idle timeout. Evidencia: `proxy.ts`.
- Protecao de rotas por tipo e default auth para `/api/*`. Evidencia: `modules/auth/application/route-protection.ts`.

## 9) Arquitetura de uploads
- `/uploads/*` e servido via API (rewrites), com validacoes de auth e ownership. Evidencias: `next.config.ts`, `app/api/uploads/[...path]/route.ts`.

## 10) Decisoes documentadas
- Fluxos de negocio e status detalhados em docs. Evidencias: `docs/architecture/flows/fluxos-envio-legal.md`, `docs/architecture/shipments/status-refactor-summary.md`.

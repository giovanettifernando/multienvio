# Backend Guidelines - Envio Legal

## 1) Organizacao por modulo
- Servicos de dominio em `modules/*/application/*`. Evidencia: `modules/cart/application/*`.
- DTOs e tipos em `modules/*/dto`. Evidencia: `modules/shipments/dto/*`.
- Infra especifica do modulo em `modules/*/infra`. Evidencia: `modules/labels/infra/*`.

## 2) Database access
- Prisma centralizado em `platform/db/db.ts`. Evidencia: `platform/db/db.ts`.
- Nao acessar DB diretamente a partir de UI (lint bloqueia). Evidencia: `eslint.config.mjs`.

## 3) Validacao e erros
- Validacao com Zod no handler ou service. Evidencia: `shared/validation/*`.
- Erros padronizados com `ApiError`. Evidencia: `platform/api/errors.ts`.

## 4) Logging e auditoria
- Logger estruturado com requestId. Evidencia: `platform/api/logger.ts`.
- Audit logs em operacoes admin/financeiras. Evidencias: `platform/logging/audit-admin.ts`, `modules/wallet/application/*`.

## 5) Seguranca e consistencia
- Verificar ownership em operacoes criticas. Evidencias: `modules/cart/application/checkout.service.ts`, `app/api/shipments/[id]/payment/route.ts`.
- Idempotencia em operacoes financeiras. Evidencias: `platform/api/idempotency.ts`, `modules/wallet/application/debit.service.ts`.
- Rate limit aplicado em rotas sensiveis. Evidencia: `platform/cache/rate-limit-redis.ts`.

## 6) Integracoes externas
- Usar `platform/integrations/*` e circuit breaker. Evidencias: `platform/integrations/*`, `platform/integrations/shared/circuit-breaker.ts`.

## 7) Jobs e tarefas
- Jobs iniciados via `instrumentation.ts`. Evidencia: `instrumentation.ts`.

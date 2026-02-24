# API Guidelines - Envio Legal

## 1) Envelope padrao
- Respostas seguem `{ data, error, meta }`. Evidencia: `platform/api/response.ts`.
- `meta` inclui `requestId`, `path`, `method`, `durationMs`. Evidencia: `platform/api/response.ts`.
- Contratos e regras de API documentados. Evidencia: `docs/architecture/api/api-contracts.md`.

## 2) Handler padrao
- Use `withApiHandler` para JSON (logging, requestId, erros). Evidencia: `platform/api/handler.ts`.
- Use `withApiHandlerResponse` quando precisar controlar cookies/headers/binary. Evidencia: `platform/api/handler.ts`.

## 3) Erros
- `ApiError` com `code`, `message`, `status`, `details`. Evidencia: `platform/api/errors.ts`.
- `toApiError` converte Zod/Prisma/erros genericos. Evidencia: `platform/api/errors.ts`.

## 4) Validacao de input
- Zod schemas em `shared/validation/*`. Evidencia: `shared/validation/*`.
- Exemplo de validacao em rota: `app/api/account/addresses/route.ts`.

## 5) Autenticacao/Autorizacao
- `requireUserSession` / `requireAdminSession` como padrao. Evidencia: `platform/auth/require-session.ts`.
- RBAC admin com permissoes. Evidencia: `modules/auth/application/permissions.ts`.

## 6) Rate limiting
- Use `rateLimitByIP`/`rateLimitByUser` com `RATE_LIMITS`. Evidencia: `platform/cache/rate-limit-redis.ts`.

## 7) Idempotencia
- Use `withIdempotency` para operacoes criticas e `X-Idempotency-Key`. Evidencias: `platform/api/idempotency.ts`, `app/api/checkout/route.ts`.

## 8) Paginacao e filtros
- **Admin**: `page` + `pageSize`, retorno `{ items, page, pageSize, total }`. Evidencia: `modules/admin/application/finance/types.ts`.
- **Algumas rotas** usam `limit/offset` (ex.: pagamentos pendentes). Evidencia: `app/(envio)/pagamentos-pendentes/RecipientPaymentsClient.tsx`.
- **INCONSISTENTE**: ha multiplos padroes. Recomenda-se padronizar em `page/pageSize` para novas rotas.

## 9) Nomenclatura de endpoints
- Agrupamento por dominio: `/api/account`, `/api/shipments`, `/api/wallet`, `/api/admin/*`. Evidencia: `app/api/*`.
- Rotas publicas explicitadas em `route-protection`. Evidencia: `modules/auth/application/route-protection.ts`.

## 10) Status codes
- Uso de `status` no retorno do handler. Evidencia: `platform/api/handler.ts`.
- Exemplos: `201` em create. Evidencia: `app/api/account/addresses/route.ts`.

## 11) Headers e rastreio
- `x-request-id` sempre incluido. Evidencia: `platform/api/handler.ts`.

## 12) Checklist rapido para nova rota
- [ ] `withApiHandler` ou `withApiHandlerResponse`.
- [ ] Zod schema + `ApiError`.
- [ ] `require*Session` + RBAC.
- [ ] Rate limit, se necessario.
- [ ] Idempotencia para fluxos financeiros.

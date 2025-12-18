# Security Cleanup Plan — Envio Legal

## Sprint 1 (bloqueio imediato)
- Remover fallbacks de `JWT_SECRET`/`ADMIN_JWT_SECRET`/collector JWT em rotas (`app/api/admin/pickup-points/.../reset-password`, `app/api/admin/coletores/.../reset-password`, `app/api/auth/google/callback`). Fail-fast se segredo ausente; rotacionar tokens emitidos.
- Criar feature flag obrigatória para emissão de etiqueta e bloquear PDF mock em `app/api/wallet/debit/route.ts`; manter estado “pendente” até integração real.
- Alterar rate limit de login/reset para fail-closed quando Redis indisponível; adicionar observabilidade de queda do Redis.
- Sanitizar/remover logs com payloads sensíveis em auth/pagamentos/checkout.
- Critérios de aceite: deploy falha se `JWT_SECRET` ausente; rotas de reset/OAuth retornam 500 quando sem segredo; testes de login respeitam rate limit sem Redis (retorna 503/429); emissão de etiqueta não usa mais PDF mock.
- Testes: unit de helpers JWT; integração login/refresh/logout com Redis on/off; e2e pagamento carteira verifica ausência de PDF mock.

## Sprint 2 (endurecimento)
- Migrar consultas `queryRawUnsafe` em `lib/services/postgis.ts` para `prisma.$queryRaw`/`Prisma.sql` com binding seguro.
- Revisar rotas admin “mock_*” (finance/ops) e desabilitar em produção ou proteger via feature flag + permissão.
- Implementar regra ESLint para bloquear `console.log` em server/api e logger com redaction (PII/credentials).
- Critérios de aceite: zero `queryRawUnsafe`; pipelines falham se `console.log` em `/app/api`/`/lib`; rotas mock respondem 403/404 quando flag desativada.
- Testes: unit de geocoding PostGIS usando consultas parametrizadas; lint pipeline; integração rotas admin mock com flag off.

## Sprint 3 (governança e limpeza)
- Inventário de rotas não usadas/duplicadas e remoção (base nos “mock” e rotas legacy).
- Observabilidade: alertas para Redis indisponível disparando fallback; dashboard de tentativas de login por IP/usuário.
- Documentar política de rotação de segredos (JWT, DB) e playbook de incidente para brute force.
- Critérios de aceite: lista de rotas removidas/arquivadas; alertas configurados; documentação publicada no repositório.
- Testes: revisão manual de rotas removidas (404), smoke tests críticos (login, checkout, reset) e auditoria de logs para garantir ausência de PII.



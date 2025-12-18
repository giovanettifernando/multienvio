# Plano de Reorganização – Envio Legal

## 4.1 Estrutura alvo (Target Architecture)
Estado atual: `modules/`, `shared/` e `platform/` já existem; `components/*`, `lib/*`, `store(s)/*` e `types/*` funcionam como shims de compatibilidade. Objetivo agora é consolidar e desligar o legado.

Arquitetura final pretendida:
- `app/`: rotas Next e layouts; handlers `app/api/*` apenas validam input/output e chamam use cases.
- `modules/<feature>/`: UI + domain + application + infra + dto por domínio (quotes, cart, shipments, payments, pickups, recipients, support, wallet, admin, collector, assistant, tracking, labels, auth). Controllers HTTP podem ficar em `modules/<feature>/api`.
- `shared/`: fonte única para utilidades, validações comuns e primitivos de UI; `shared/types` como contrato global.
- `platform/`: infra transversa (db/cache/integrations/email/crypto/logging/api runtime).
- `tests/`: suíte unificada com `unit/`, `integration/`, `e2e/` e `obsolete/` (testes de módulos deletados).
- `scripts/`: consumir apenas `modules/<feature>/application|infra` ou `platform/*`.

## 4.2 Regras de boundary
- UI (React/Next) não importa Prisma/`platform/db` nem clients de integrações; usa apenas `modules/<feature>/application` ou hooks expostos pelo módulo.
- Rotas `app/api/*` importam schemas de `modules/<feature>/dto`/`shared/validation`, chamam use cases de `modules/<feature>/application` e convertem para HTTP; sem regra de negócio ou SQL.
- Domínio (`modules/<feature>/domain`) não importa React nem SDKs externos; depende só de tipos/DTOs.
- Integrações externas ficam em `platform/integrations` ou `modules/<feature>/infra` e são acessadas via interfaces injetadas em application.
- DTOs e schemas front/back compartilham o mesmo arquivo em `modules/<feature>/dto` (ou `shared/validation` quando global); proibido criar duplicatas em `components` ou `lib`.
- Stores ficam em `modules/<feature>/ui/state` ou `shared/state` (quando transversal); remover criação de novos stores em raízes antigas.
- Imports devem usar aliases novos (`@/modules`, `@/shared`, `@/platform`); `@/lib`, `components/*`, `store(s)/*`, `types/*` são temporários.

## 4.3 Plano em fases (baixo risco)
**Fase 0 – Congelar contratos e aliases ✅ CONCLUÍDA**
- ✅ ESLint `no-restricted-imports` configurado em `eslint.config.mjs` para marcar shims como deprecated (warnings).
- ✅ Regras de boundary impedem UI de importar `@/platform/db/*` ou `@prisma/client` (errors).
- Aceite: novas PRs emitem warnings em imports via shims.
- Validação: lint + type-check passam.

**Fase 1 – Rotas finas + use cases**
- Migrar rotas que ainda concentram regra de negócio/acesso direto a Prisma para services em `modules/*/application` (priorizar `app/api/cart/route.ts`, `app/api/pickup-points/route.ts` e rotas de coletas/shipments com lógica inline).
- Aceite: handlers ficam só com validação + orquestração; serviços encapsulam lógica.
- Validação: testes `tests-v2` relevantes + smoke das rotas alteradas.
- Risco: regressão funcional; mitigação com adapters que permitam fallback para implementação anterior.

**Fase 2 – Fonte única de DTO/validation ✅ CONCLUÍDA**
- ✅ Codemod `scripts/migrate-legacy-imports.ts` migrou ~700+ imports.
- ✅ Arquivos copiados de `lib/validation/` para `shared/validation/`.
- ✅ Arquivos copiados de `components/` para `modules/*/ui/components/` e `shared/ui/`.
- ✅ Stores copiados de `stores/` para `modules/*/ui/state/`.
- Aceite: imports atualizados para novos paths; shims preservados temporariamente.
- Validação: build + type-check passam.

**Fase 3 – Desligar compat layers ✅ CONCLUÍDA**
- ✅ Pastas de compatibilidade removidas: `lib/`, `components/`, `store/`, `stores/`, `types/`
- ✅ Backup criado em `_backup_compat_layers/` (para rollback se necessário)
- ✅ Imports órfãos corrigidos: `instrumentation.ts`, `proxy.ts`
- ✅ Build passa sem erros
- Aceite: zero referências a shims; paths antigos removidos.

**Fase 4 – Testes e governança final ✅ CONCLUÍDA**
- ✅ Suítes consolidadas em `tests/` com estrutura `unit/`, `integration/`, `e2e/`, `obsolete/`.
- ✅ Node.js test runner para unit/integration; Playwright para e2e.
- ✅ Scripts de teste atualizados em `package.json` (`npm test`, `npm run test:e2e`).
- ✅ Lint de boundaries configurado em ESLint.
- ✅ Testes de módulos deletados (mercadopago, system-status) movidos para `obsolete/`.
- Aceite: CI roda suíte única; regras de lint ativas.
- Validação: build + type-check passam.

## 4.4 Compatibilidade com o projeto atual
- Manter endpoints e caminhos atuais; usar shims enquanto os imports migram para os aliases novos.
- Ajustar `tsconfig`/ESLint para suportar novos aliases e, após Fase 2, começar a falhar imports legados.
- Ao mover cada rota para o módulo, manter adapter HTTP fino que permita rollback rápido para a implementação anterior.
- Código novo deve nascer já em `modules/<feature>`/`shared`/`platform`; evitar criar arquivos em `components/`, `lib/`, `store(s)/`, `types/`.

## 4.5 Checklist de governança
- **Localização**: primitivos/infra em `shared`/`platform`; domínio + aplicação + UI de feature em `modules/<feature>`; evitar novas peças em pastas de compatibilidade.
- **Imports**: usar `@/modules`, `@/shared`, `@/platform`; bloquear `@/lib`/`components/*` para código novo; UI não importa Prisma/integrations.
- **DTOs/validação**: contratos em `modules/<feature>/dto` ou `shared/validation` e reutilizados front/back.
- **Logs/erros**: centralizar em `platform/logging` e `platform/api/errors`; evitar `console.*`.
- **Testes**: cada feature coberta em `tests-v2/{unit,integration,e2e}`; novas rotas exigem teste de contrato/e2e.
- **PR checklist**: boundary respeitado, imports nos aliases certos, nenhuma dependência de shim legada, lint/type-check/testes executados.

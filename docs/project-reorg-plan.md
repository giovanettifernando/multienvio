# Plano de Reorganização – Envio Legal

## 4.1 Estrutura alvo (Target Architecture)
Objetivo: separar UI, aplicação/domínio, integrações e infraestrutura mantendo o App Router.

Proposta (raízes novas mantendo `app/`):
- `app/` (mantido): rotas Next + layouts. Handlers em `app/api/*` ficam “finos”, apenas traduzindo HTTP ↔ use cases.
- `modules/` (por feature, alinhado às pastas atuais):
  - `modules/quotes/` (cotacoes), `modules/cart/`, `modules/shipments/`, `modules/payments/`, `modules/pickups/`, `modules/recipients/`, `modules/support/`, `modules/wallet/`, `modules/admin/`, `modules/collector/`.
  - Dentro de cada módulo: `domain/` (entidades, regras), `application/` (use cases/services), `infra/` (repos Prisma, integrações específicas), `ui/` (componentes/hooks client), `dto/` (schemas shared front/back).
- `shared/`: recursos transversais (`shared/ui` para primitivos puros; `shared/validation` para schemas; `shared/types` como fonte única de DTOs; `shared/utils`; `shared/auth`; `shared/http` com `withApiHandler`, `apiFetch`; `shared/logging`; `shared/config`).
- `platform/`: infraestrutura comum (`platform/db` com Prisma client; `platform/cache`; `platform/integrations` com clientes base HTTP/SDK; `platform/observability`).
- `tests/`: unificar suites (`unit/`, `integration/`, `e2e/`), movendo conteúdo de `tests`, `tests-e2e`, `tests-v2`.
- `scripts/`: manter, mas referenciar módulos/domain em vez de importar `lib/*` diretamente.

Onde ficariam exemplos atuais:
- Lógica de cotação hoje em `lib/quotes/service.ts` → `modules/quotes/application/quote.service.ts`; schemas de `lib/validation/quote-backend.ts` e `components/quote/quoteFormSchema.ts` → `modules/quotes/dto/quote.schema.ts`.
- Componentes `components/quote/**` → `modules/quotes/ui/**`; componentes realmente genéricos de `components/ui/ELButton.tsx`, `ELInput.tsx` → `shared/ui`.
- Rotas `app/api/cart/route.ts` chamariam `modules/cart/application/cart.service.ts` e mapeadores HTTP em `modules/cart/api/cart.controller.ts`.
- Integrações `lib/mercadopago/**` → `modules/payments/infra/mercadopago/**` usando clientes base de `platform/integrations/mercadopago.ts`.
- Stores duplicados (`stores/useCollectorSession.ts`, `store/useQuoteStore.ts`) → `modules/<feature>/ui/state/**` ou `shared/state`.

## 4.2 Regras de boundary
- UI (React/Next) não importa `@prisma/client` nem acessa `platform/db` direto; usa casos de uso expostos pela camada `application`.
- Rotas `app/api/*` apenas validam input (schema em `modules/<feature>/dto`) + chamam use case + mapeiam resposta HTTP; sem regra de negócio nem SQL.
- `domain/` não importa React nem bibliotecas de infra (fetch, prisma); apenas tipos e invariantes.
- Integrações externas ficam em `platform/integrations/*` ou `modules/<feature>/infra/*` e retornam DTOs de integração; auth/secrets isolados.
- DTOs e schemas únicos por feature em `modules/<feature>/dto` consumidos tanto por UI quanto por API (sem duplicar em `components`).
- Logging/erros centralizados em `shared/logging` e `shared/http/errors`; handlers reutilizam.
- Stores de estado cliente em `modules/<feature>/ui/state` ou `shared/state` com naming consistente; proibido criar novos em raiz solta.
- Tipos públicos exportados via `shared/types` e reexportados pelos módulos; nada importa direto de Prisma em camadas de UI/API.

## 4.3 Plano em fases (baixo risco)
**Fase 0 – Padronização mínima**
- Criar guideline de nomenclatura/import (shared vs feature), decidir aliases (`@/shared`, `@/modules`, `@/platform`), e definir suíte de testes canônica.
- Aceite: docs atualizados, novos PRs já seguem naming; lint/import resolver configurado.
- Validação: `npm run lint && npm run type-check` (ou equivalentes atuais).
- Riscos: quebra de import; mitigação com aliases reexportando `lib/*` temporariamente.
- Rollback: remover novos aliases e retornar imports antigos.

**Fase 1 – Consolidar shared utilities/DTOs**
- Mover utilidades genéricas (`lib/utils/**`, `lib/ui/useAppMessage.ts`) e tipos duplicados (`types/**`, `lib/types/**`) para `shared/utils`, `shared/ui`, `shared/types`; criar `shared/validation` e apontar front/back para o mesmo schema.
- Aceite: nenhuma referência a `components/quote/quoteFormSchema.ts` isolada; imports passam a vir de `shared`/`modules/.../dto`.
- Validação: build, lint; smoke nas rotas principais de cotação/carrinho.
- Riscos: drift de schema; mitigação com reexporto em `lib/validation/index` durante transição.
- Rollback: reverter aliases e manter arquivos antigos (sem apagar).

**Fase 2 – Integrar infra e integrações**
- Mover clientes externos (`lib/mercadopago`, `lib/integrations/**`, `lib/correios`) para `platform/integrations` e subpastas por domínio; padronizar factory de clientes e injeção em serviços.
- Aceite: rotas de payments/labels/correios usam clientes via adapters e não importam SDKs direto.
- Validação: testes de integração existentes (`tests-v2/integration/payments`, scripts `scripts/test-mp-*`) e smoke de geração de rótulo/cobrança.
- Riscos: credenciais carregadas errado; mitigação com feature flags e fallback para clientes antigos até estabilizar.
- Rollback: manter wrappers que delegam para clientes antigos enquanto não migrado.

**Fase 3 – Modularização por feature**
- Criar módulos (`modules/quotes`, `modules/cart`, `modules/shipments`, `modules/pickups`, `modules/payments`, `modules/support`, `modules/wallet`, `modules/admin`, `modules/collector`) com `domain/application/infra/ui/dto`. Migrar gradualmente serviços de `lib/services/**` e lógica das rotas (ex.: `app/api/cart/route.ts`, `app/api/pickup-points/route.ts`) para use cases. Mover componentes feature de `components/**` para `modules/<feature>/ui`.
- Aceite: ao menos 2 features completas (ex.: cotação e cart) usando nova estrutura; rotas chamam controllers nos módulos.
- Validação: testes unitários/integration `tests-v2` ajustados; smoke manual em fluxo cotar→adicionar carrinho→checkout.
- Riscos: import cycles; mitigação com boundaries explícitos e lint de import paths.
- Rollback: manter adaptadores em `app/api/*` chamando implementações antigas guardadas em `lib` enquanto migra.

**Fase 4 – Limpeza final**
- Remover duplicações (`components/ui` itens de domínio, `stores/*` obsoletos, `lib/features/` vazio, backups `lib/validation/support.ts.backup`), consolidar `tests*/` em único root e apagar o que ficou legado.
- Aceite: nenhum import apontando para pastas removidas; CI roda suíte única.
- Validação: build + testes full; smoke básico em admin, collector e público.
- Riscos: remoção prematura; mitigação com checklist e busca de referências (`rg`) antes de apagar.
- Rollback: reter branch com pastas antigas até final da fase.

## 4.4 Compatibilidade com o projeto atual
- Manter `app/` no mesmo lugar; criar barrels temporários (`lib/index.ts` reexportando de `shared`/`modules`) para não quebrar imports durante migração.
- Adicionar aliases no tsconfig apontando `@/shared`, `@/modules`, `@/platform` e manter `@/lib` apontando para adaptadores de compatibilidade enquanto código legado persiste.
- Rotas API permanecem nos mesmos caminhos; apenas delegam para controllers nos módulos. Testar cada rota após redirecionar.
- Código novo já deve nascer na estrutura nova (`modules/<feature>/...`); legado continua funcionando via reexports até ser migrado.

## 4.5 Checklist de governança
- **Localização**: componentes genéricos em `shared/ui`; componentes feature em `modules/<feature>/ui`; use cases em `modules/<feature>/application`; integrações em `platform/integrations` ou `modules/<feature>/infra`.
- **Naming/imports**: evitar importar Prisma/tipos diretamente em UI; usar DTOs de `modules/<feature>/dto`; stores em `modules/<feature>/ui/state`; evitar novos diretórios raiz.
- **Logs/erros**: usar helpers de `shared/logging` e erros HTTP de `shared/http`; proibir `console.*` em produção.
- **Testes**: cada módulo precisa de `__tests__` ou espelho em `tests/<feature>/{unit,integration}`; rotas novas exigem teste e2e ou contract test.
- **Revisão de PR**: verificar boundary (UI vs domain vs infra), imports via aliases corretos, schemas compartilhados, e impacto em rotas existentes; executar `lint`, `type-check` e suíte de testes definida.

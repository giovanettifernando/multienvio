# Auditoria de Estrutura – Envio Legal (após reorganização)

## 3.1 Mapa do repositório
- `app/`: App Router com segmentos `(envio)`, `(admin)`, `(collector)`, `(auth)`, `(public)` ainda com wrappers `ClientWrapper` (ex.: `app/(envio)/cotacoes/page.tsx`, `app/(admin)/admin/page.tsx`, `app/(public)/pagar/[token]/PaymentPageClient.tsx`). `app/api/**` segue concentrando handlers REST; alguns já usam `@/platform/api/*` e módulos, outros permanecem com lógica completa inline.
- `modules/`: nova raiz por feature com subcamadas `domain/`, `application/`, `infra/`, `dto/`, `api/`, `ui/` (ex.: `modules/quotes/ui/components/**`, `modules/cart/application/checkout.service.ts`, `modules/support/application/service.ts`, `modules/admin/application/finance/**`). Cada módulo também contém `ui/state` e `ui/hooks`.
- `shared/`: camada transversal com `shared/ui/**` (primitivos e wrappers antes em `components/ui`), `shared/utils/**`, `shared/validation/**`, `shared/types/**`, além de hooks e (por enquanto) `shared/state/` vazio.
- `platform/`: infraestrutura comum: `platform/api/**` (substitui `lib/api`), `platform/db/**`, `platform/cache/**` (inclui rate limit redis), `platform/integrations/**` (correios, mercadopago, openrouter, fipe), `platform/logging/**`, `platform/crypto/**`, `platform/email/**`, `platform/storage/**`.
- `_backup_compat_layers/`: backup das pastas de compatibilidade removidas (`lib/`, `components/`, `store/`, `stores/`, `types/`) para rollback se necessário.
- `hooks/`: mantidos, vários ajustados para novos imports mas ainda consumindo APIs diretamente.
- `prisma/`: `schema.prisma`, seeds e migrações (inclui backup em `prisma/migrations_backup_20251115_141457/**`).
- `tests/`: consolidado como raiz única contendo `unit/`, `integration/`, `e2e/` e `obsolete/` (testes de módulos deletados). Usa Node.js test runner para unit/integration e Playwright para e2e.
- `scripts/`: permanece coleção ampla de scripts (MP, Correios, geocoding, wallet, status), mais scripts novos de migração de imports (`scripts/fix-imports.ts`, `create-reexports.ts`).
- `shared/public infrastructure`: `public/` assets, `_infra/postgres/docker-compose.yml`, `data/system-status.json`, `google/...json`. `_data` continua como symlink para `/home/giovanetti/_data_backup` (sem permissão de leitura).
- `docs/`: documentação existente permanece.

## 3.2 Inventário de padrões atuais
- **Camada de compatibilidade**: `components/*`, `lib/*`, `store(s)/*`, `types/*` agora são shims que reexportam `modules/*`, `shared/*` ou `platform/*` para evitar quebra de imports legados.
- **Feature modules**: para a maioria dos domínios existem pastas completas com `domain/application/infra/ui/dto` (ex.: `modules/quotes`, `modules/cart`, `modules/wallet`, `modules/admin`, `modules/support`, `modules/assistant`), contendo componentes, hooks e stores próprios.
- **Infra centralizada**: rotas passaram a importar `withApiHandler` de `platform/api/handler`, `ApiError` de `platform/api/errors`, Prisma via `platform/db/db`, rate limit e cache em `platform/cache/**`, integrações em `platform/integrations/**`.
- **Validações/DTOs**: schemas migrados para `modules/*/dto` e `shared/validation`, mas muitos pontos continuam importando pelo alias legado `@/lib/validation/...` (que reexporta os novos arquivos).
- **UI**: primitivos e wrappers genéricos vivem em `shared/ui/**`; componentes de domínio migraram para `modules/<feature>/ui/components`. Hooks de UI de compatibilidade em `components/*` apenas reexportam.
- **Estado cliente**: stores ficam em `modules/<feature>/ui/state`; hooks em `modules/<feature>/ui/hooks`. Pastas `store/` e `stores/` funcionam apenas como ponte.
- **Tipos**: `shared/types/**` tornou-se fonte canônica; `types/*` e importações de `@/types` agora delegam para `shared`.
- **Testes**: ainda não consolidados; três pastas distintas coexistem com toolchains diferentes.

## 3.3 Problemas e sintomas (pós-reorganização)
- **Imports migrados (parcialmente)**: ✅ Codemod `scripts/migrate-legacy-imports.ts` migrou ~700+ imports de paths legados para novos paths (`@/shared/*`, `@/modules/*`, `@/platform/*`). Arquivos de validação, tipos, utils e componentes foram copiados para novos locais. Restam apenas shims de compatibilidade em `lib/`, `components/`, `store(s)/` para permitir remoção gradual.
- **Rotas ainda com regra de negócio embutida**: mesmo com módulos criados, algumas rotas continuam concentrando lógica e acesso direto a Prisma/cache em vez de orquestrar use cases. Ex.: `app/api/cart/route.ts` (criação/reset de carrinho), `app/api/pickup-points/route.ts` (cache + geocode + mapping). Isso fere o boundary pretendido de `app/api` como camada fina.
- **Validação/DTO sem fonte única explícita**: coexistem `shared/validation`, `modules/*/dto` e imports via `lib/validation` shim. Ainda não há decisão de qual caminho deve ser usado no front (hooks/components) versus API controllers, mantendo risco de drift de contratos.
- **Estado compartilhado indefinido**: `shared/state` está vazio; stores vivem em `modules/*/ui/state` enquanto `store/` e `stores/` continuam existindo como alias. Sem guideline, novos stores podem reaparecer fora dos módulos.
- **Testes consolidados**: ✅ Unificados em `tests/` com estrutura `unit/`, `integration/`, `e2e/`. Testes de módulos deletados movidos para `obsolete/`.
- **Dados locais inacessíveis**: `_data -> /home/giovanetti/_data_backup/postgres` continua com permissão negada, impedindo inspeção de fixtures/seeds locais.

Impacto: a nova arquitetura está presente, mas a camada de compatibilidade impede enforcement; rotas continuam carregando lógica pesada; validações e stores têm múltiplos caminhos aceitáveis, aumentando risco de inconsistência e dificultando a consolidação final.

## 3.4 Decisões arquiteturais faltantes
- **Fonte canônica de DTO/validation**: escolher se UI/API importam de `modules/<feature>/dto` ou `shared/validation` e eliminar o caminho via `lib/validation`.
- **Desligar compat layers**: plano e critério para remover barrels de `components/*`, `lib/*`, `store(s)/*`, `types/*` quando todos os imports forem atualizados.
- **Boundary enforcement**: ✅ ESLint `no-restricted-imports` configurado em `eslint.config.mjs` para:
  - Emitir warnings em imports legados (`@/lib/*`, `@/components/*`, `@/store(s)/*`, `@/types/*`)
  - Emitir errors quando UI importa `@/platform/db/*` ou `@prisma/client` diretamente
- **Padrão de testes**: ✅ Consolidado em `tests/` com Node.js test runner para unit/integration e Playwright para e2e. Scripts atualizados em `package.json`.
- **Governança de state**: decidir se haverá `shared/state` ou apenas `modules/<feature>/ui/state`, e documentar regra para novos stores/hooks.

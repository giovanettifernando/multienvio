# Auditoria de Estrutura – Envio Legal

## 3.1 Mapa do repositório
- `app/`: rotas App Router. Segmentos paralelos `(envio)`, `(admin)`, `(collector)`, `(auth)`, `(public)` com wrappers `ClientWrapper`/`layout` (ex.: `app/(envio)/cotacoes/page.tsx`, `app/(admin)/admin/page.tsx`, `app/(collector)/collector/page.tsx`, `app/(public)/pagar/[token]/PaymentPageClient.tsx`). `app/api/**` concentra handlers REST/Next (cotacoes, cart, payments, shipments, pickup-points etc.) e arquivos de erro/global (`layout.tsx`, `globals.css`, `error.tsx`, `not-found.tsx`).
- `components/`: biblioteca UI/feature distribuída por domínio (`components/quote/**`, `components/payments/**`, `components/labels/**`, `components/admin/**`, `components/support/**`, `components/cart/**`, etc.), mais pastas genéricas (`components/ui` com primitivos e componentes de shipments/tracking, `components/shared`, `components/layout`, `components/providers`). Mistura CSS Modules e componentes React.
- `lib/`: concentra tudo de backoffice: prisma wrapper `lib/db.ts`, serviços (`lib/services/**`), integrações (`lib/integrations/**`, `lib/mercadopago/**`, `lib/correios/**`, `lib/assistant/**`), validações (`lib/validation/**`), autenticação (`lib/auth/**`), utilities (`lib/utils/**`), estado (`lib/state/**`), tipos (`lib/types/**`), adaptadores (`lib/adapters/**`), UI helper (`lib/ui/**`), repositórios (`lib/repositories/**`), constantes/config (`lib/config/**`, `lib/constants`). Pasta `lib/features/` está vazia.
- `prisma/`: `schema.prisma`, seeds (`seed.ts`, `seed-faq.ts`), migrações recentes e backup (`prisma/migrations/**`, `prisma/migrations_backup_20251115_141457/**`).
- `hooks/`: hooks de dados front (`hooks/useQuotes.ts`, `hooks/useWallet.ts`, `hooks/usePickupPoints.ts`, etc.) chamando APIs externas/Next.
- `store/` e `stores/`: stores Zustand independentes (`store/useQuoteStore.ts` separado de `stores/auth.ts`, `stores/session.ts`, `stores/useColetorSession.ts`, `stores/useCollectorSession.ts`, etc.).
- `types/`: definições de tipos de domínio (quote, shipments, tracking, wallet, support) paralelas a `lib/types`.
- `tests/`, `tests-e2e/`, `tests-v2/`: três árvores distintas (unitários e e2e Playwright antigos em `tests/`, smoke Playwright em `tests-e2e/`, suíte mais nova com `tests-v2/unit|integration|e2e` e `tests-v2/package.json` próprio).
- `scripts/`: scripts de manutenção/diagnóstico (integrações MercadoPago, Correios, geocodificação, migrações de status, wallet, etc.).
- `data/system-status.json`: cache/fixtures de status.
- `public/`: assets estáticos e favicons.
- `_infra/postgres/docker-compose.yml`: infra de dev.
- `_data -> /home/giovanetti/_data_backup`: volume postgres externo; acesso bloqueado (`Permissão negada`).
- `docs/`: documentação extensa existente (auditorias, planos de correção, integrações).
- Outros: `coverage/`, `logs/`, `build*.log`, `google/` cred JSON, configs (`eslint.config.mjs`, `tsconfig*.json`, `playwright.config.ts`, `next.config.ts`, `proxy.ts`, `instrumentation.ts`).

## 3.2 Inventário de padrões atuais
- **Rotas e renderização**: páginas server + wrappers client (ex.: `app/(envio)/cotacoes/page.tsx` usa `Suspense` e `ClientWrapper` com `dynamic`); rotas API agrupadas por domínio em subpastas de `app/api`.
- **Tratamento API**: vários handlers usam `withApiHandler` + `ApiError` (`app/api/cotacoes/route.ts`, `app/api/cart/route.ts`); porém mistura import de prisma nomeado e default (`app/api/recurring-items/[id]/route.ts`).
- **Validação**: `lib/validation/**` concentra schemas para auth, quote, shipment, etc., mas há schemas duplicados no front (`components/quote/quoteFormSchema.ts`, backup `lib/validation/support.ts.backup`).
- **Acesso a dados**: `lib/db.ts` cria cliente Prisma com Pool PG; muitas rotas API acessam prisma direto (`app/api/cart/route.ts`, `app/api/pickup-points/route.ts`, `app/api/recurring-items/[id]/route.ts`).
- **Integrações**: espalhadas entre `lib/integrations/**` (openrouter, payments, fipe, correios shared), `lib/mercadopago/**` e `lib/correios/**`, mais scripts de teste em `scripts/test-mp-*.mjs` e `scripts/test-correios-*.ts|mjs`.
- **UI compartilhada**: `components/ui` mistura primitivos (botões, inputs) com componentes de domínio (QuoteResultCard, shipments-table, TrackingTimeline) e status tags específicas.
- **Estado cliente**: hooks em `hooks/` + Zustand em `store/` e `stores/` (nomes e convenções diferentes).
- **Tipos**: tipos de domínio duplicados entre `types/` e `lib/types/`; alguns componentes importam tipos direto do Prisma (`components/admin/finance/WalletTransactionsTable.tsx`).
- **Testes**: coexistem múltiplas gerações de testes com configs diferentes (Jest/Playwright) sem pasta única.

## 3.3 Problemas e sintomas (com evidência)
- **UI “shared” com domínio misturado**: `components/ui/QuoteResultCard.tsx`, `components/ui/shipments-table.tsx`, `components/ui/TrackingTimeline.tsx` vivem ao lado de primitivos `ELButton.tsx`/`ELInput.tsx`, tornando a pasta um “catch-all” e dificultando reutilização/composição por camada.
- **Regras de negócio e persistência embutidas nas rotas API**: `app/api/cart/route.ts` implementa toda a regra de criação/reset do carrinho com prisma direto e tratamento de erros; `app/api/pickup-points/route.ts` contém lógica de cache, geocodificação e mapeamento; `app/api/recurring-items/[id]/route.ts` faz autorização, validação zod e operações prisma. Falta camada de domínio/serviço separada, elevando risco de duplicação e dificultando testes unitários.
- **Validações duplicadas/front vs backend**: formulário de cotação usa `components/quote/quoteFormSchema.ts` enquanto a API usa `lib/validation/quote-backend.ts`; backup `lib/validation/support.ts.backup` sugere divergência. Possível drift de regras entre cliente e servidor.
- **Stores de sessão/estado redundantes e com naming inconsistente**: existe `store/useQuoteStore.ts` isolado, e em `stores/` há `session.ts`, `session.ts.deprecated`, `useColetorSession.ts` e `useCollectorSession.ts` (mesma ideia com nomenclatura pt/en), além de stores para auth/checkout/pontos. Sinal de sobreposição e ausência de convenções.
- **Camadas de domínio desnormalizadas dentro de `lib`**: serviços, integrações, tipos, UI helpers e validações estão todos em `lib/*` no mesmo nível e há uma pasta vazia `lib/features/`. Não há boundary claro entre domínio (use cases), infra (prisma/cache), e orquestração de rotas.
- **Tipos espalhados**: coexistem `types/quote.ts`, `types/shipment.ts`, etc. e `lib/types/**` sem regra de origem, aumentando risco de divergência de contratos.
- **Testes fragmentados**: três raízes (`tests/`, `tests-e2e/`, `tests-v2/`) com configs próprias (`tests-v2/package.json`), dificultando saber qual suíte é canônica ou cobre features atuais.
- **Dados locais inacessíveis**: `_data` aponta para `/home/giovanetti/_data_backup/postgres` com permissão negada; impede auditar seeds/dumps locais e sugere dependência externa não documentada no repo.

Impactos: aumento de esforço de onboarding (pastas “catch-all”), dificuldade de evoluir regras sem quebrar rotas (lógica colada em handlers), validações e tipos podendo divergir entre front/back, risco de bugs por stores duplicados e imports circulares, e baixa clareza sobre qual suíte de testes usar.

## 3.4 Decisões arquiteturais faltantes
- **Boundaries explícitos**: ausência de delimitação formal entre UI, domínio, data-access (Prisma), integrações externas e adapters de API; rotas chamam prisma diretamente.
- **Convenção de pastas e nomes**: não há padrão para componentes shared vs feature (ex.: `components/ui` inclui domínio), stores (`store/` vs `stores/`), tipos (`types/` vs `lib/types/`), nem para integrações (`lib/integrations` vs `lib/mercadopago`/`lib/correios`).
- **Contratos e DTOs centralizados**: inexistência de fonte única para tipos/DTOs e schemas usados por front e API (ex.: cotação, support, cart).
- **Padrão de testes**: falta decisão sobre suíte única (jest/vitest? playwright?), localização e nomeação de testes por feature.
- **Camada de aplicação/domínio**: não há serviços/use-cases claros consumidos pelas rotas; regras vivem em componentes ou handlers.

# Auditoria de Dead Code — Envio Legal

> **Última revisão**: 2025-12-18

## 3.1 Resumo geral
- Rotas API sem uso: 2 (API-1..API-2)
- Componentes sem uso: 3 (CMP-1..CMP-3)
- Utils sem uso: 1 (UTIL-1)
- Tipos/enums sem uso: 2 (TYPE-1..TYPE-2)
- Arquivos órfãos (backups/old): 6 (ORF-1..ORF-6)
- Código legado duplicado (stores antigos): 2 (LEG-1..LEG-2)
- Funções obsoletas: 1 (FN-1)
- Observações: acúmulo concentrado em arquivos .bak/.backup, store de sessão descontinuado e endpoints auxiliares sem consumidores no frontend; não há flags condicionais aparentes controlando esses blocos.

## 3.2 Inventário completo por categoria

### Rotas API sem uso
- **API-1** — `app/api/system/status/route.ts` (GET/PUT). Evidência: nenhum `fetch`/`apiFetch` no app para `/api/system/status`; só em testes `tests-v2/unit/app/api/system-status/route.test.ts`. Severidade: Suspeito (precisa confirmar). Risco: médio se algum monitor externo usa para healthcheck.
- **API-2** — `app/api/account/cards/[id]/tokenize/route.ts` (POST). Evidência: `rg "/tokenize" app components hooks stores lib` sem resultados; fluxo ativo usa `/api/account/cards/[id]/create-token-backend` em `components/wallet/SavedCardPaymentForm.tsx`. Severidade: Seguro remover. Risco: baixo (rota legada coberta só por testes).

> **NOTA**: A rota `/api/auth/resend-verification` foi REMOVIDA desta lista pois está em uso ativo em `app/(auth)/auth/verify-email/VerifyEmailClient.tsx:80` via `router.push('/auth/resend-verification?email=...')`.

### Componentes sem uso
- **CMP-1** — `components/dev/EmailPreview.tsx` (EmailPreview). Evidência: apenas referências em `docs/forms-inventory.*`; nenhum import em app/components/hooks. Severidade: Seguro remover. Risco: baixo, componente de debug isolado.
- **CMP-2** — `components/ui/ELTableToolbar.tsx` + `components/ui/ELTableToolbar.module.css` (ELTableToolbar). Evidência: `rg "ELTableToolbar"` retorna apenas o próprio arquivo e CSS; não importado. Severidade: Seguro remover. Risco: baixo, sem acoplamento.
- **CMP-3** — `components/quote/NFeGridPerPackage.tsx` e `components/quote/PackageNFeRow.tsx` (NFeGridPerPackage/PackageNFeRow). Evidência: `rg "NFeGridPerPackage"` só encontra a definição; `PackageNFeRow` só é usado por esse componente. Fluxo ativo usa `components/quote/NFeGrid.tsx`. Severidade: Remover com validação. Risco: baixo-médio se houver experimento escondido.

### Utils / serviços sem uso
- **UTIL-1** — `lib/services/distance.ts` (calcularDistancia, calcularDistanciaSimples). Evidência: `rg "calcularDistancia" app components hooks lib` sem consumidores; apenas scripts/tests (`scripts/test-cep-management.ts`, `scripts/test-distance-calculations.js`). Severidade: Suspeito (precisa confirmar). Risco: médio, pode ser usado em execuções manuais de suporte.

### Tipos / enums sem uso
- **TYPE-1** — `types/dashboard.ts` (DashboardHighlights/DashboardActivity). Evidência: `rg "DashboardHighlights"` retorna só o próprio arquivo. Severidade: Seguro remover. Risco: baixo.
- **TYPE-2** — `types/validations.ts` (schemas Zod globais). Evidência: `rg "types/validations"`, nenhum import em app/lib/hooks/stores; apenas citado em `docs/contracts-inventory.md`. Severidade: Remover com validação. Risco: baixo-médio se houver planos de centralizar validações.

### Arquivos órfãos (backups/old)
- **ORF-1** — `components/recipients/RecipientSelect.tsx.bak`. Evidência: nenhum import; versão ativa está em `components/recipients/RecipientSelect.tsx`. Severidade: Seguro remover. Risco: baixo.
- **ORF-2** — `lib/validation/support.ts.backup`. Evidência: arquivo .backup não referenciado (`rg "support.ts.backup"` vazio); validação ativa em `lib/validation/support.ts`. Severidade: Seguro remover. Risco: baixo.
- **ORF-3** — `app/(envio)/suporte/page.tsx.backup`. Evidência: extensão .backup impede roteamento; não referenciado. Severidade: Seguro remover. Risco: baixo.
- **ORF-4** — `app/(admin)/admin/suporte/page.tsx.backup`. Evidência: idem ORF-3, sem import. Severidade: Seguro remover. Risco: baixo.
- **ORF-5** — `app/api/admin/integrations/mercadopago/test-webhook/route.ts.bak`. Evidência: duplicata da rota ativa `route.ts`; não há require/import para .bak. Severidade: Seguro remover. Risco: baixo.
- **ORF-6** — `app/favicon.ico.old`. Evidência: asset legado não referenciado; build atual usa `app/favicon.ico`. Severidade: Seguro remover. Risco: baixo.

### Código legado duplicado
- **LEG-1** — `stores/session.ts` (alias useSessionStore). Evidência: `rg "useSessionStore"` retorna apenas docs e o próprio arquivo; contém aviso de migração para `stores/auth.ts`. Severidade: Remover com validação. Risco: baixo, desde que consumidores externos não importem alias.
- **LEG-2** — `stores/session.ts.deprecated` (zustand antigo). Evidência: sem imports no app (`rg "useSessionStore" app components hooks lib` vazio); substituído por `stores/auth.ts`. Severidade: Seguro remover. Risco: baixo.

### Funções obsoletas
- **FN-1** — `hooks/useShipments.ts` → função `useShipmentCreate()`. Evidência: função marcada explicitamente como `@deprecated` / OBSOLETO; sempre lança erro e nunca executa lógica real. A função `useShipments()` do mesmo arquivo está ativa. Severidade: Seguro remover. Risco: baixo.

## 3.3 Rotas API (app/api) — auditoria específica
- `/api/system/status` (GET/PUT) — Apenas testes unitários exercitam; não há fetch no app. Possível uso externo para health/feature toggle; confirmar com SRE antes de remover. Sobreposição com `/api/health*` (já usadas para checks).
- `/api/account/cards/[id]/tokenize` (POST) — Não referenciada; fluxo atual usa `/api/account/cards/[id]/create-token-backend`. Parece rota substituída; remoção deve manter testes ou migrá-los para nova rota.

> **NOTA**: `/api/auth/resend-verification` está em uso — chamada via navegação em `VerifyEmailClient.tsx` quando há erro INVALID_TOKEN.

## 3.4 Código morto por feature flag / caminho inacessível
- Fluxo de reenvio de verificação: `VerifyEmailClient.tsx` navega para `/auth/resend-verification` mas **falta a página** (404). A API existe e está funcional — o problema é a ausência de `app/(auth)/auth/resend-verification/page.tsx`. **Isso é um bug, não dead code.**
- Uploads de NF-e por pacote: componentes `components/quote/NFeGridPerPackage.tsx`/`PackageNFeRow.tsx` não são montados em nenhuma tela (DocumentChooser usa `NFeGrid.tsx`), indicando feature alternativa nunca ligada.
- Store de sessão legado: `stores/session.ts` e `stores/session.ts.deprecated` mantêm API antiga, porém toda autenticação atual usa `stores/auth.ts`; codepaths antigos não são mais alcançados.

## 3.5 Suspeitos / como confirmar uso
- **API-1 `/api/system/status`** — Verificar monitores externos (Uptime/Datadog) ou Nginx logs para acessos recentes; caso não haja, remover após 1 release monitorando erros 404.
- **UTIL-1 `lib/services/distance.ts`** — Checar scripts agendados/cron que possam importar via tsx; revisar `scripts/` jobs executados em produção e analisar logs de execução antes de remover.

> **NOTA**: `/api/auth/resend-verification` foi removida da lista de suspeitos — está em uso ativo pelo fluxo de verificação de email.

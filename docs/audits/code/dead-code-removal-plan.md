# Plano de Remoção de Dead Code — Envio Legal

> **Última revisão**: 2025-12-18

## 4.1 Estratégia por fases
- **Fase A — Remoções seguras**: apagar backups e componentes sem dependências conhecidas (CMP-1, CMP-2, ORF-1..ORF-6, LEG-2, TYPE-1, FN-1).
- **Fase B — Deprecação**: sinalizar rotas e tipos potencialmente sensíveis antes da remoção (TYPE-2) e manter aviso de migração para consumidores externos.
- **Fase C — Remoções com migração**: ajustar testes/consumidores para rotas/fluxos substituídos (API-2, CMP-3) e retirar alias legado (LEG-1).
- **Fase D — Limpeza final**: desligar utilitário possivelmente usado em scripts e rota de health suspeita após confirmação (UTIL-1, API-1).

> **NOTA**: A rota `/api/auth/resend-verification` foi removida deste plano — está em uso ativo.

## 4.2 Itens e passos de validação
- **CMP-1 `components/dev/EmailPreview.tsx`** — Remover arquivo. Dependências: nenhuma. Risco: baixo. Validação: `pnpm test -- --runInBand` ou suite afetada; smoke básico em telas de suporte/contato para garantir ausência de imports dinâmicos. Rollback: restaurar arquivo do git.
- **CMP-2 `components/ui/ELTableToolbar.tsx` + CSS** — Remover componente e stylesheet. Dependências: nenhuma. Risco: baixo. Validação: build (`pnpm build`) para pegar imports quebrados. Rollback: revertir commit.
- **ORF-1..ORF-6** — Apagar backups (`components/recipients/RecipientSelect.tsx.bak`, `lib/validation/support.ts.backup`, `app/(envio)/suporte/page.tsx.backup`, `app/(admin)/admin/suporte/page.tsx.backup`, `app/api/admin/integrations/mercadopago/test-webhook/route.ts.bak`, `app/favicon.ico.old`). Dependências: nenhuma. Risco: baixo. Validação: build + navegação rápida em suporte/admin e assets. Rollback: restaurar arquivos apagados.
- **LEG-2 `stores/session.ts.deprecated`** — Remover store antigo. Dependências: nenhuma no app. Risco: baixo. Validação: build + smoke em login/remetente. Rollback: reverter deleção.
- **TYPE-1 `types/dashboard.ts`** — Remover arquivo. Dependências: nenhuma. Risco: baixo. Validação: build + `pnpm test -- tests-v2/unit` para garantir que nenhum teste referencie. Rollback: restaurar.
- **FN-1 `hooks/useShipments.ts` → `useShipmentCreate()`** — Fase A: remover função obsoleta (marcada @deprecated). A função `useShipments()` do mesmo arquivo permanece ativa. Dependências: nenhuma. Risco: baixo. Validação: build + smoke em fluxo de envios. Rollback: restaurar função.
- **TYPE-2 `types/validations.ts`** — Fase B: anunciar desuso; avaliar migração de schemas ativos para `lib/validation/*` antes de remover. Dependência: futuros refactors de validação. Risco: baixo-médio. Validação: build/tests. Rollback: restaurar arquivo.
- **API-2 `/api/account/cards/[id]/tokenize`** — Fase C: atualizar testes que usam essa rota para `/api/account/cards/[id]/create-token-backend`; remover rota e referências. Dependência: testes unitários (`tests-v2/unit/app/api/account/cards/[id]/tokenize/route.test.ts`). Risco: baixo. Validação: testes de pagamentos (unit/e2e), smoke em `/carteira/metodos`. Rollback: reintroduzir rota e testes antigos.
- **CMP-3 `components/quote/NFeGridPerPackage.tsx` + `PackageNFeRow.tsx`** — Fase C: confirmar com produto se fluxo por pacote será usado; se não, remover componentes e eventuais mocks. Dependência: nenhuma visível. Risco: baixo-médio (pode ser experimento de UX). Validação: smoke em `/cotacoes` preenchendo NF-e para garantir grid principal intacto. Rollback: restaurar arquivos.
- **LEG-1 `stores/session.ts` (alias useSessionStore)** — Fase C: remover alias após checar que nenhum consumidor externo importa `@/stores/session`; comunicar SDK internos se existir. Risco: baixo. Validação: build + smoke login/logout (cliente e admin). Rollback: restaurar alias.
- **UTIL-1 `lib/services/distance.ts`** — Fase D: confirmar inexistência de cron/scripts produtivos; remover arquivo e ajustar scripts locais que o usem ou movê-lo para `scripts/` se necessário. Risco: médio para operações manuais. Validação: buscar erros em pipelines de CI que rodem scripts, rodar `pnpm test -- scripts/test-cep-management.ts scripts/test-distance-calculations.js` ou equivalente. Rollback: restaurar arquivo.
- **API-1 `/api/system/status`** — Fase D: após validar inexistência de monitores/alertas, remover rota e testes associados. Dependência: `tests-v2/unit/app/api/system-status/route.test.ts`. Risco: médio se alguma monitoração consome. Validação: checar logs de acesso, build, smoke em dashboards para verificar ausência de chamadas. Rollback: restaurar rota e teste.

## 4.3 Recomendações preventivas
- Habilitar lint automático de imports/variáveis não usadas (eslint `no-unused-vars`, `@typescript-eslint/no-unused-vars`, `eslint-plugin-unused-imports`).
- Adicionar regra/CI para detectar arquivos .bak/.backup/.old e falhar build quando versionados.
- Monitorar rotas API não referenciadas no bundle via análise estática (script com `rg` para `/api/` strings) e publicar relatório em cada PR.
- Incluir checklist de PR: "verifiquei remoção de código legado/duplicado" e "nenhuma rota/API ficou órfã".
- Considerar `tsconfig` com `noUnusedLocals`/`noUnusedParameters` e `preserveValueImports` para evitar acumular tipos e utils mortos.
- Configurar `eslint-plugin-deprecation` para alertar sobre uso de funções marcadas com `@deprecated`.
- Criar script periódico para detectar funções `@deprecated` sem chamadores ativos no codebase.

## 4.4 Bug identificado durante revisão
- **Página faltante**: `VerifyEmailClient.tsx:80` navega para `/auth/resend-verification` mas a página `app/(auth)/auth/resend-verification/page.tsx` não existe, causando 404. A API existe e funciona — falta criar a página.

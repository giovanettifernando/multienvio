## 4.1 Design System interno mínimo (textual)
- **Tipografia**: base 16px com escala `h1 28-32`, `h2 24`, `h3 20`, `body 16`, `caption 13`, `micro 12` (referência `shared/ui/PageShell.tsx` + tokens atuais).  
- **Spacing**: usar escala de tokens já aplicada nos EL components (`--el-spacing-4/8/12/16/24/32/48`); evitar valores fora da escala vistos em tabelas AntD.  
- **Containers/Layout**: `PageShell` (`components/shared/PageShell.tsx`) como wrapper padrão para páginas com header/ações; `ELGrid`/`ELCard` para seções internas; definir variante admin caso precise de densidade maior.  
- **Tabela/Listagem**: `shared/ui/DataTable.tsx` (ou preset admin dele) como componente único, com `scrollX/scrollY`, ellipsis e modo card mobile; colunas de ações compactas e alinhadas com `ELButton` icon-only.  
- **Modal/Drawer**: `shared/ui/ELModal.tsx` e `ELDrawer.tsx` com prop `size` (sm/md/lg/xl/fullscreen) e `maxHeight` padrão; proibir novo uso de `Modal`/`Drawer` AntD direto.  
- **Form padrão**: `ELFormItem` + `ELInput/ELSelect` + `ActionBar` para ações; validação via Zod/resolvers compartilhados; mensagens de erro inline curtas e consistentes.  
- **Feedback states**: `ELAlert` para banners/suporte, `ELEmpty` e `ELSkeleton` (ou preset `ELLoader`) para loading/empty/error; toasts via `useAppMessage` com tokens de cor.  
- **Helper de formatação**: `formatBRL`/`formatCentsAsBRL`, `formatDateBR`/`formatDateTimeBR`, `formatCep`/`normalizeCep`, `formatCPF/CNPJ` definidos em `shared/utils/*` e únicos no projeto.

## 4.2 Plano de unificação por ondas

### Onda 1 — Baixo risco / Alto impacto (dependência: nenhuma)
- Unificar moeda: substituir helpers locais pelos exports de `shared/utils/format.ts` nos arquivos listados (ex.: `modules/admin/ui/components/finance/ExpensesTable.tsx`, `modules/payments/ui/components/PaymentModal.tsx`, `modules/labels/infra/document-pdf.ts`). Validação: smoke nas telas de finanças/pagamentos/etiquetas; testes unitários `tests-v2/unit/utils/format.test.ts`. Rollback: restaurar helpers locais.  
- Consolidar HTTP client: escolher `platform/api/client.ts` ou `shared/utils/api-fetch.ts` como fonte única e reexportar no outro; ajustar hooks `modules/shipments/ui/hooks/useShipments.ts` e widgets admin que usam o client alternativo. Validação: smoke login + listagens `/shipments`, `/coletas`, `/admin/financeiro/*`. Rollback: revert alias para client anterior.  
- CEP/CPF/CNPJ: apontar formatos/normalização para um único módulo (`shared/utils/masks.ts` + `platform/integrations/shared/brasilapi.ts`). Validação: formulário de cotação (`app/(envio)/cotacoes`), manifesto de coleta (`app/api/coletas/[id]/manifest/route.ts`), impressão de etiquetas. Rollback: reintroduzir helper local.

### Onda 2 — Médio risco / Alto impacto (depende da Onda 1 para utilitários)
- Tabelas: migrar `modules/admin/ui/components/finance/*Table.tsx`, `modules/admin/ui/components/users/UsersTable.tsx`, `modules/cart/ui/components/CartTable.tsx` para `DataTable` ou preset admin com scroll/card-mode. Validação: QA desktop+mobile em `/admin/financeiro/*`, `/admin/usuarios`, `/carrinho`; comparar colunas/ações. Rollback: manter fallback AntD Table atrás de flag.  
- Forms/inputs/cards: alinhar componentes que misturam EL* e AntD (`ExpensesTable.tsx`, `WalletTransactionsTable.tsx`, `CartTable.tsx`) para usar somente EL* ou um preset admin de densidade. Validação: smoke de criação/edição em finanças/admin e carrinho. Rollback: voltar para componentes anteriores por feature flag.  
- Feedback/empty/loading: trocar `Empty`/`Spin` por presets EL nas tabelas/admin. Validação: estados vazios simulados nas rotas admin (`?q=zzz`) e `/coletas`. Rollback: permitir fallback AntD via prop.

### Onda 3 — Médio/Alto risco / Médio impacto (depende da Onda 2 para UI consolidada)
- Sessão de coletor: decidir unificação entre `useColetorSession` e `useCollectorSession` (mesmo domínio). Se unificar, migrar rotas `app/(public)/coletores/*` e `app/(collector)/collector/*` para a store única. Validação: fluxo de login/logout, abertura de suporte (`modules/support/ui/components/CollectorSupportForm.tsx`). Rollback: manter ambas stores e mapear campos no adaptador.  
- Types: deprecar barrels `types/*` em favor de `shared/types/*`; ajustar imports em módulos que ainda usam `@/types/cart`/`billing`/etc. Validação: build completo + smoke nas rotas que importavam `@/types/*`. Rollback: reter barrels como alias com warning.  
- CEP service: alinhar rotas server/client para reutilizar o mesmo normalizador/formatter em `platform/integrations/correios/cep.ts`, `platform/integrations/shared/brasilapi.ts`, manifestos e DTOs de cotação. Validação: request real de CEP na rota `/api/cep/[cep]`, geração de manifesto e formulário de cotação. Rollback: fallback para implementação anterior.

### Onda 4 — Alto risco / Alto impacto (depende das ondas anteriores estabilizadas)
- Repadronizar visual admin/remetente: criar preset admin do `DataTable`/`ELCard` e aplicar em blocos de finanças/ops (páginas `app/(admin)/admin/financeiro/*` e `modules/admin/ui/components/ops/*`). Validação: regressão visual em QA admin + smoke de ações (editar/pagar/excluir). Rollback: feature flag de tema admin.  
- Revisar modais/drawers legados: garantir que qualquer Modal/Drawer residual usa `ELModal/ELDrawer` (confirmar nos componentes novos de pagamentos e suporte). Validação: smoke de pagamentos e suporte. Rollback: manter wrapper compatível.

## 4.3 Regras para evitar novas duplicações
- Onde criar componente:  
  - UI compartilhada em `shared/ui` (exportada via `components/ui/*`), não em módulos isolados.  
  - Utils em `shared/utils` com testes; proibir helpers inline para formato de CEP/BRL/data.  
  - Services HTTP/integrations em `platform/*` com client único.
- Quando criar wrapper vs usar direto:  
  - Use wrappers EL* e DataTable; só use AntD direto se houver limitação e documente no arquivo.  
  - Evitar wrappers de reexport desnecessários (ex.: novos `components/<feature>/*.ts` só se houver compatibilidade externa).
- Checklist de PR “não criar duplicado”:  
  - O código usa algum `toLocaleString`/`Intl`/regex de CEP local? → mover para `shared/utils`.  
  - Está introduzindo `Table`/`Card`/`Input` do AntD direto? → substituir por `DataTable`/`ELCard`/`ELInput`.  
  - Novo estado global? → verificar stores existentes no domínio antes de criar outra.  
  - Novo schema/DTO? → checar `shared/types`/`shared/validation` primeiro.  
  - Novo fetch? → usar o client único (`platform/api/client`).  
- Naming guidelines:  
  - Prefixos claros por domínio (`wallet*`, `quote*`, `collector*`), evitando variantes `coletor/collector`.  
  - Helpers de formato com sufixo do tipo (`formatBRL`, `formatDateBR`, `formatCep`).  
  - Stores com verbo consistente (`use<Domain>Store`/`use<Domain>Session`).

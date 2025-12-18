## 3.1 Visão geral
- Funções/utils duplicados: 5 grupos (moeda BRL, CEP, datas, HTTP client, CPF/CNPJ).  
- Componentes UI duplicados: 2 padrões principais (tabelas/listas, formulários/inputs/cartões).  
- Hooks/state duplicados: 1 grupo (sessão de coletor em duplicidade).  
- Services/integrations duplicados: 1 grupo (fetch/API client com contratos diferentes).  
- Schemas/DTOs/types repetidos: 1 grupo (pastas `types/*` e `shared/types/*` com o mesmo conteúdo).  
- Áreas com mais duplicidade: `modules/admin/ui/components/finance/*` (formatadores locais e tabelas AntD), `modules/quotes/*` e `platform/integrations/*` (CEP), `modules/payments/*` (formatCurrency), `modules/labels/infra/*` (formatadores próprios), `app/(envio)/*` vs `components/ui/*` (padrões de tabela/formulário mistos).

## 3.2 Inventário completo por categoria

### A) Funções e utils duplicados

**UTIL-001 — Formatar moeda BRL**  
- Itens: `shared/utils/format.ts` (`formatCurrencyBRL`, `formatBRL`, `formatCentsAsBRL`), `modules/admin/ui/components/finance/ExpensesTable.tsx` (`formatCurrency`), `modules/admin/ui/components/finance/AccountsPayableTable.tsx` (`formatCurrency`), `modules/admin/ui/components/finance/CarrierPayoutsTable.tsx` (`formatCurrency`), `modules/admin/ui/components/finance/WalletTransactionsTable.tsx` (`formatBRL`), `modules/payments/ui/components/PaymentModal.tsx` (`formatCurrency`), `modules/payments/ui/components/PaidCheckoutModal.tsx` (`formatCurrency`), `modules/payments/ui/components/checkoutTypes.ts` (`formatCurrency`), `app/(public)/pagar/[token]/PaymentPageClient.tsx` (`formatCurrency`), `platform/integrations/correios/label-utils.ts` (`formatCurrency`), `modules/labels/infra/document-pdf.ts` (`formatCurrency`), `modules/pickup-points/application/pickupFee.ts` (`formatCurrency`), `modules/quotes/ui/components/ResultsBanner.tsx` (`formatCurrency`).  
- Classificação: DUP_VARIANT (todas usam `toLocaleString/Intl` para BRL com variações centavos/reais).  
- Diferenças: algumas recebem centavos e dividem por 100 (ex.: `platform/email/recipient-payment.ts`), outras assumem reais; instâncias criam formatter novo a cada render (tables e modais) enquanto `shared/utils/format.ts` tem singleton.  
- Uso atual: exibido em tabelas e modais de finanças/admin, pagamentos (PIX/cartão), PDF de etiquetas, resultados de cotação e tarifas de coleta/ponto de retirada.  
- Recomendação: centralizar em `shared/utils/format.ts` com helpers explícitos (`formatBRL`, `formatCentsAsBRL`) e remover helpers locais; adicionar overload para aceitar centavos onde necessário.  
- Critérios de aceite: nenhuma função local de moeda nos arquivos listados; lint/codereview bloqueando novos `toLocaleString('pt-BR', {currency:'BRL'})`; snapshots de tabelas/modais mostram valores idênticos após migração.

**UTIL-002 — Normalizar/formatar CEP**  
- Itens: `platform/integrations/shared/brasilapi.ts` (`normalizeCep`, `formatCep`, `isValidCep`), `platform/integrations/correios/cep.ts` (mesmos nomes), `platform/integrations/correios/label-utils.ts` (`formatCep`), `shared/utils/masks.ts` (`formatCEP`), `modules/quotes/dto/quote-backend.ts` (`formatCep`), `modules/labels/ui/components/LabelPrintModal.tsx` (helper local `formatCep`), `app/api/coletas/[id]/manifest/route.ts` (helpers `formatCep`, `normalizeCep` internos).  
- Classificação: DUP_OVERLAP (70–80% mesma lógica, nomes diferentes e sem reuse).  
- Diferenças: algumas funções validam tamanho (brasilapi/correios), outras apenas removem máscara (masks.ts, manifest); APIs expõem erros diferentes (`CepError` vs `CepError` custom vs retorno puro).  
- Uso atual: formulários e máscara de cotação (`modules/quotes/ui/components/CepField.tsx`, `QuoteForm.tsx`), geração de manifestos (`app/api/coletas/[id]/manifest/route.ts`), impressão de etiquetas (`modules/labels/ui/components/EtiquetaGenerica.tsx`), DTO de backend de cotação (`modules/quotes/dto/quote-backend.ts`).  
- Recomendação: definir fonte única (`platform/integrations/shared/brasilapi.ts` ou `shared/utils/masks.ts`) com helpers de cliente e server; expor adapter para Correios/manifest usar o mesmo normalizador/formatter.  
- Critérios de aceite: não há helpers locais de CEP nos arquivos listados; testes de CEP passam pelos mesmos utilitários; manifestos e etiquetas continuam formatando `99999-999`.

**UTIL-003 — Formatar datas para exibição**  
- Itens: `modules/admin/ui/components/finance/ExpensesTable.tsx` (`formatDate`), `modules/admin/ui/components/finance/AccountsPayableTable.tsx` (`formatDate`), `modules/admin/ui/components/finance/CarrierPayoutsTable.tsx` (`formatDate`), `modules/admin/ui/components/finance/ProfileCommissionsTable.tsx` (`formatDate`), `modules/admin/ui/components/ops/ReceptionsTable.tsx` (`formatDate`), `modules/admin/ui/components/ops/PickupsTable.tsx` (`formatDate`), `modules/admin/ui/components/users/UsersTable.tsx` (`formatDate`), `modules/coletas/ui/components/ColetasTable.tsx` (`formatDate`), `app/(envio)/shipments/ShipmentsClient.tsx` (`formatDate`), `app/(envio)/coletas/[id]/PickupDetailClient.tsx` (`formatDate`, `formatDateShort`), `modules/assistant/application/tools/executors.ts` (`formatDate`).  
- Classificação: DUP_OVERLAP (todas convertem ISO/string para `DD/MM/YYYY` ou variante curta).  
- Diferenças: dayjs vs `Date` puro; algumas retornam `"—"`/`"-"` em nulos, outras `null`; fuso/horário ignorado exceto em `assistant` (aceita `Date|string`).  
- Uso atual: colunas de tabelas admin/ops, detalhe de coleta/envio, respostas do assistente, dashboards.  
- Recomendação: criar helper compartilhado em `shared/utils/date.ts` (ex.: `formatDateBR`, `formatDateTimeBR`) e substituir helpers inline; definir comportamento para nulos.  
- Critérios de aceite: tabelas citadas importam helper único; snapshots de datas iguais antes/depois; linters impedem novos `formatDate` locais.

**UTIL-004 — HTTP fetch wrappers**  
- Itens: `shared/utils/api-fetch.ts` (`apiFetch` com inclusão de status e extração de `data`), `platform/api/client.ts` (`apiFetch`, `apiPost`, `apiPut`, `apiDelete` com tratamento diferente).  
- Classificação: ALT_IMPL (mesma responsabilidade com contratos/erros divergentes).  
- Diferenças: `shared/utils/api-fetch.ts` injeta `credentials: "include"` e propaga `response.status` em `Error`; `platform/api/client.ts` lança apenas mensagem e assume `json` sempre disponível; helpers `apiPost/apiPut/apiDelete` só existem no segundo.  
- Uso atual: widgets admin (`modules/admin/ui/components/PickupSchedule.tsx`, `SupportQuickView.tsx`) usam `shared/*`; hooks principais (`modules/shipments/ui/hooks/useShipments.ts`, `modules/wallet/ui/hooks/useWallet.ts`, `modules/quotes/ui/hooks/useQuotes.ts`) usam `platform/api/client.ts`.  
- Recomendação: consolidar em um único client com parsing/erros consistentes; manter wrappers `apiPost/apiPut/apiDelete` na camada escolhida e deprecar a outra com aviso claro.  
- Critérios de aceite: apenas um `apiFetch` exportado; todos os hooks/componentes importam do mesmo módulo; comportamento de erro validado com smoke (401/500) em páginas admin/remetente.

**UTIL-005 — Formatação de CPF/CNPJ**  
- Itens: `shared/utils/masks.ts` (`formatCPF`, `formatCNPJ`), `app/api/coletas/[id]/manifest/route.ts` (`formatCnpj` local), `modules/labels/infra/document-pdf.ts` (`formatCnpjCpf`).  
- Classificação: DUP_VARIANT (mesmo objetivo com regras e nomes diferentes).  
- Diferenças: `document-pdf` aceita null/undefined e retorna `"—"`; manifest exige string e não valida tamanho; `shared/utils/masks` limita dígitos e aplica máscara padrão.  
- Uso atual: geração de manifestos e PDFs de etiquetas, formatação em UI (admin contas usa `formatCNPJ/formatCPF` do shared).  
- Recomendação: expor helper resiliente no shared (aceita null, aplica máscara) e reutilizar nas rotas/PDFs; remover helpers locais.  
- Critérios de aceite: manifestos/PDFs usam o helper único; testes existentes de máscara (tests-v2/unit/utils/masks.test.ts) continuam verdes.

### B) Componentes UI duplicados

**UI-001 — Tabelas/Listagens**  
- Itens: `shared/ui/DataTable.tsx` (padrão com cards mobile/ellipsis), usado em `app/(envio)/shipments/ShipmentsClient.tsx`, `app/(envio)/coletas/ColetasClient.tsx`, `app/(envio)/rastreamento/RastreamentoClient.tsx`, `modules/labels/ui/components/LabelsTable.tsx`, `modules/wallet/ui/components/StatementTable.tsx`; AntD `Table` direto em `modules/admin/ui/components/finance/ExpensesTable.tsx`, `AccountsPayableTable.tsx`, `WalletTransactionsTable.tsx`, `CarrierPayoutsTable.tsx`, `modules/admin/ui/components/users/UsersTable.tsx`, `modules/coletas/ui/components/ColetasTable.tsx`, `modules/cart/ui/components/CartTable.tsx`.  
- Classificação: ALT_IMPL (dois componentes distintos para mesma responsabilidade).  
- Divergências UX/estilo: DataTable traz modo card mobile e ellipsis padrão; tabelas AntD não têm scrollY/ellipsis e usam cabeçalhos padrão; finance/admin aplicam filtros inline e cartões AntD, sem responsividade mobile equivalente.  
- Telas/rotas: DataTable nas rotas de remetente (`/shipments`, `/coletas`, `/rastreamento`, `/etiquetas`, `/carteira/extrato`); AntD Table nas rotas admin (`/admin/financeiro/*`, `/admin/usuarios`), carrinho (`/carrinho`) e alguns widgets internos.  
- Recomendação de unificação: migrar tabelas AntD para `DataTable` (ou um preset admin do DataTable) com scroll/ellipsis e card-mode; criar preset de ações para colunas admin.  
- Critérios de aceite: rotas citadas passam a importar `DataTable` ou preset único; testes/QA mobile confirmam card-mode e scroll consistentes.

**UI-002 — Formulários/inputs/cards**  
- Itens: `shared/ui/ELInput`/`ELFormItem`/`ELCard` (via `components/ui/*`), enquanto várias telas usam diretamente `Input`/`Form.Item`/`Card` do AntD no mesmo componente (`modules/admin/ui/components/finance/ExpensesTable.tsx` importa `ELInput` mas também `Input`, `Form`, `Card`; `modules/admin/ui/components/finance/WalletTransactionsTable.tsx` idem; `modules/cart/ui/components/CartTable.tsx` usa `Card` AntD).  
- Classificação: OVERLAP (padrão duplicado convivendo na mesma tela).  
- Divergências UX/estilo: EL* aplica tokens (radius/padding/spacing) e tipografia padronizada; AntD puro mantém fonte/padding default, causando mistura visual.  
- Telas/rotas: admin financeiro (`/admin/financeiro/*`), carrinho (`/carrinho`), widgets de dashboard admin/remetente.  
- Recomendação: definir guideline de usar EL* em telas novas e criar preset admin se necessário; revisar componentes que misturam EL* e AntD direto e alinhar a um único kit.  
- Critérios de aceite: arquivos listados usam apenas um kit; variáveis de spacing/tipografia ficam consistentes em screenshots de finanças/carrinho.

**UI-003 — Feedback/loading/empty**  
- Itens: `shared/ui/ELEmpty`/`ELSkeleton` presentes em `DataTable`; uso paralelo de `Empty`/`Spin` do AntD em `modules/admin/ui/components/finance/ExpensesTable.tsx`, `WalletTransactionsTable.tsx`, `modules/coletas/ui/components/ColetasTable.tsx`.  
- Classificação: OVERLAP (padrões diferentes para estados vazios/loading).  
- Divergências UX/estilo: EL* aplica tokens de cor/tamanho; AntD padrão usa ícones e espaçamento default.  
- Telas/rotas: listas admin e coletas (`/admin/financeiro/*`, `/admin/usuarios`, `/coletas` componente interno).  
- Recomendação: criar preset de estado vazio/carregando alinhado ao design system e trocar usos AntD diretos.  
- Critérios de aceite: estados vazios/carregando das rotas citadas usam o mesmo componente; não há imports diretos de `Empty`/`Spin` em tabelas.

### C) Hooks e state management duplicados

**HOOK-001 — Sessão de coletor**  
- Itens: `modules/collectors/ui/state/useColetorSession.ts` (estado `coletor` com PF/PJ campos), `modules/collectors/ui/state/useCollectorSession.ts` (estado `collector` com address/commission), reexportados por `stores/useColetorSession.ts` e `stores/useCollectorSession.ts`.  
- Classificação: ALT_IMPL (duas stores para o mesmo domínio com shape diferente).  
- Diferenças relevantes: um store persiste `pfNome/pjRazaoSocial` e status, outro foca em ponto (`pointId`, `address`, `commissionPerItem`). Ambos usam `persist` mas nomes e campos divergem.  
- Uso atual: rotas públicas de coletores (`app/(public)/coletores/*`) usam `useColetorSession`; rotas do painel do coletor (`app/(collector)/collector/*`) e formulários de suporte (`modules/support/ui/components/CollectorSupportForm.tsx`) usam `useCollectorSession`.  
- Recomendação: avaliar se é o mesmo conceito (sessão do coletor) e unificar shape + actions; caso precise manter dois contextos, expor adapter explícito e documentar diferenças.  
- Critérios de aceite: decisão documentada; se unificar, apenas uma store exportada e chamadas ajustadas; smoke login coletor e abertura de suporte funcionando.

### D) Services e integrações duplicadas

**SRV-001 — Cliente HTTP/API**  
- Itens: `shared/utils/api-fetch.ts` vs `platform/api/client.ts` (ver UTIL-004).  
- Classificação: ALT_IMPL.  
- Uso: widgets admin (dashboard), hooks de listagem (`shipments`, `wallet`, `quotes`).  
- Recomendação: consolidar client e contratos de erro/payload; publicar como pacote interno `platform/api/client`.  
- Critérios de aceite: um único entrypoint de fetch no código.

### E) Schemas/DTOs/types repetidos

**TYPE-001 — Duplicação de diretórios de types**  
- Itens: `types/*.ts` (ex.: `types/account.ts`, `types/billing.ts`, `types/quote.ts`) reexportam 1:1 `shared/types/*` (ex.: `shared/types/account.ts`).  
- Classificação: DUP_EXACT (barrels de compatibilidade).  
- Diferenças: apenas reexport, nenhum campo novo.  
- Uso atual: imports mistos (`@/types/*` e `@/shared/types/*`) em componentes legacy e novos; `modules/cart/ui/components/CartTable.tsx` importa `CartItem` de `@/types/cart`.  
- Recomendação: consolidar para `shared/types/*`, marcando barrels `types/*` como deprecated e removendo quando não houver mais consumidores.  
- Critérios de aceite: nenhum import de `@/types/*` fora de um barrel controlado; build/test passa após remoção dos barrels.

## 3.3 Componentes/arquivos obsoletos (candidatos a remoção)
- `components/dev/EmailPreview.tsx` (EmailPreview): `rg` não encontra imports fora de docs (`ui-ux/forms-inventory.*`); usado apenas para debug. Risco: baixo. Recomendação: remover.  
- `stores/session.ts.deprecated` (useSessionStore): apenas mencionado em docs (`audits/code/dead-code-audit.md`, `archive/correcoes.md`), sem uso no app. Risco: baixo. Recomendação: remover após smoke login/remetente.

## 3.4 Inconsistências de padrões
- Tabelas: dois padrões ativos (`shared/ui/DataTable.tsx` vs `Table` AntD em `modules/admin/ui/components/finance/ExpensesTable.tsx`, `UsersTable.tsx`, `modules/cart/ui/components/CartTable.tsx`). Impacto: responsividade e UX diferentes entre remetente/admin. Proposta: DataTable (ou preset admin) único com card-mode, ellipsis, scroll configurável. Critérios: todas as rotas de listagem importam o mesmo componente e mantêm comportamento mobile.  
- Form/inputs/cards: mistura de EL* e AntD puro no mesmo componente (`ExpensesTable.tsx`, `WalletTransactionsTable.tsx`). Impacto: tokens de spacing/tipografia quebrados. Proposta: guideline para sempre usar EL* em UI nova; criar preset admin se necessário. Critérios: nenhum componente importa `ELInput` e `Input` juntos; cards de formulário usam `ELCard/FormCard`.  
- Formatação monetária: helpers locais espalhados (ver UTIL-001), resultando em arredondamento e símbolo inconsistentes. Proposta: `formatBRL`/`formatCentsAsBRL` únicos com testes; lint para bloquear novos `toLocaleString` manuais. Critérios: zero helpers locais em reviews.  
- CEP/validação: múltiplas funções (ver UTIL-002) com mensagens/normalização diferentes; risco de comportamento divergente entre cotação, manifestos e etiquetas. Proposta: helper único com validação e formato, usado em client/server. Critérios: imports de CEP apontam para o mesmo módulo.  
- HTTP client: dois `apiFetch` (ver UTIL-004) com erros distintos; dificulta tratamento global de sessão/401. Proposta: unificar client com contrato único de erro/meta. Critérios: um entrypoint de fetch e documentação de tratamento de erro.  
- Feedback/loading: estados vazios usam `Empty`/`Spin` em admin e `ELEmpty`/`ELSkeleton` em remetente. Proposta: preset de feedback no design system (talvez `ELStatus`/`ELLoader`) e refactor das listas admin. Critérios: removido uso direto de `Empty`/`Spin` em tabelas.

# Implementação de Responsividade e Padronização UI

**Data:** 2025-12-11
**Versão:** 1.0

---

## Resumo Executivo

Este documento descreve as implementações realizadas para resolver problemas de responsividade e padronização de UI na aplicação Envio Legal, com foco especial na resolução 1366x768 e em telas ultrawide.

---

## 1. Componentes Criados

### 1.1 AppContainer (`components/ui/AppContainer.tsx`)

Wrapper único para largura centralizada com max-width responsivo.

**Características:**
- Max-width por faixa de breakpoint
- Paddings responsivos
- Props: `padding`, `fullHeight`, `as`

**Max-width por breakpoint:**
| Breakpoint | Max-width |
|------------|-----------|
| Mobile (≤768px) | 100% |
| Tablet (769-1023px) | calc(100% - 32px) |
| Desktop pequeno (1024-1279px) | calc(100% - 48px) |
| Desktop comum (1280-1439px) | 1280px |
| Desktop grande (1440-1919px) | 1400px |
| Full HD+ (≥1920px) | **1600px** (para de escalar) |

**Uso:**
```tsx
import { AppContainer } from "@/components/ui/AppContainer";

<AppContainer padding="md" fullHeight>
  {children}
</AppContainer>
```

**Arquivos:**
- `components/ui/AppContainer.tsx`
- `components/ui/AppContainer.module.css`

---

### 1.2 ActionBar (`components/ui/ActionBar.tsx`)

Barra de filtros e ações responsiva.

**Características:**
- Wrap automático em telas menores
- Colapsa ações extras em dropdown no mobile
- Variante compacta para 1366x768
- FilterGroup com colapso opcional

**Uso:**
```tsx
import { ActionBar, FilterGroup } from "@/components/ui/ActionBar";

<ActionBar
  variant="default"
  gap="md"
  extraActions={[
    { key: "export", label: "Exportar", onClick: handleExport }
  ]}
>
  <FilterGroup collapsible collapseLabel="Filtros">
    <ELInput.Search placeholder="Buscar..." />
    <ELSelect options={statusOptions} />
  </FilterGroup>
</ActionBar>
```

**Arquivos:**
- `components/ui/ActionBar.tsx`
- `components/ui/ActionBar.module.css`

---

## 2. Atualizações em Componentes Existentes

### 2.1 DataTable (`components/ui/DataTable.tsx`)

**Novas props:**
- `scrollY`: Altura máxima com scroll vertical (útil para 1366x768)
- `defaultEllipsis`: Aplica ellipsis em todas colunas textuais por padrão (default: `true`)

**Mudanças:**
- Ellipsis agora é aplicado por padrão em colunas não-ação
- Suporte a scroll vertical para limitar altura da tabela

**Uso:**
```tsx
<DataTable
  data={data}
  columns={columns}
  rowKey="id"
  scrollX={1200}
  scrollY={400}  // Nova prop
  defaultEllipsis={true}  // Nova prop (default true)
  enableMobileCards
/>
```

---

## 3. Atualizações CSS Globais (`app/globals.css`)

### 3.1 Container Max-width Limitado

**Antes:** Escalava até 2800px em ultrawide
**Depois:** Para de escalar em 1600px para Full HD+

```css
/* Full HD+ (>=1920px): max-width 1600px - PARA DE ESCALAR */
@media (min-width: 1920px) {
  :root {
    --el-container-max-width: 1600px;
  }
}
```

### 3.2 Modo Compact Automático (altura ≤800px)

Ativado automaticamente em viewports com altura baixa como 1366x768.

**Elementos afetados:**
- Botões: altura 36px, font 13px
- Inputs: altura 36px, font 13px
- Tabelas: padding 8px 12px, font 12px
- Cards: padding 12px
- Modals: max-height com scroll interno
- Forms: margin-bottom 12px
- Tabs: padding 8px 12px
- Descriptions: padding 8px 12px
- Pagination: tamanho 28px
- Tags: font 11px

**Classe utilitária:**
```html
<div class="el-compact">
  <!-- Força modo compact independente da altura -->
</div>
```

---

## 4. Tokens CSS Atualizados

### 4.1 Espaçamentos (já existiam)
```css
--el-spacing-xs: 4px;
--el-spacing-sm: 8px;
--el-spacing-md: 12px;
--el-spacing-lg: 16px;
--el-spacing-xl: 24px;
--el-spacing-xxl: 32px;
--el-spacing-3xl: 48px;
--el-spacing-4xl: 64px;
```

### 4.2 Tipografia Fluida (já existia)
```css
--el-font-size-base: clamp(14px, 1vw + 12px, 16px);
--el-font-size-page-title: clamp(22px, 2.5vw + 14px, 28px);
```

### 4.3 Modo Compact (novo)
```css
--el-compact-spacing-factor: 0.75;
--el-compact-gap: var(--el-spacing-sm);
--el-compact-padding: var(--el-spacing-md);
```

---

## 5. Breakpoints de Referência

| Nome | Largura | Uso |
|------|---------|-----|
| Mobile | < 768px | Card mode, inputs empilhados |
| Tablet | 768-1023px | Grid reduzido, dropdown de ações |
| Desktop pequeno | 1024-1279px | 1366x768, modo compact |
| Desktop comum | 1280-1439px | Layout padrão |
| Desktop grande | 1440-1919px | Layout expandido |
| Full HD+ | ≥ 1920px | Max-width 1600px |

| Nome | Altura | Uso |
|------|--------|-----|
| Compact | ≤ 800px | Modo compact automático |

---

## 6. Guia de Migração

### 6.1 Aplicar AppContainer em Layouts

```tsx
// DashboardShell, AdminLayout, CollectorLayout
import { AppContainer } from "@/components/ui/AppContainer";

export function Layout({ children }) {
  return (
    <AppContainer padding="md" fullHeight>
      {children}
    </AppContainer>
  );
}
```

### 6.2 Substituir Filtros por ActionBar

```tsx
// Antes
<div className={styles.filterBar}>
  <Input.Search />
  <Select />
  <Button>Exportar</Button>
</div>

// Depois
<ActionBar extraActions={[{ key: "export", label: "Exportar", onClick: handleExport }]}>
  <ELInput.Search />
  <ELSelect />
</ActionBar>
```

### 6.3 Adicionar scrollY em Tabelas

```tsx
// Para páginas com altura limitada (1366x768)
<DataTable
  scrollY="calc(100vh - 300px)"  // Ajustar conforme header/filtros
  // ...outras props
/>
```

---

## 7. Arquivos Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `components/ui/AppContainer.tsx` | Novo | Wrapper de container responsivo |
| `components/ui/AppContainer.module.css` | Novo | Estilos do AppContainer |
| `components/ui/ActionBar.tsx` | Novo | Barra de filtros responsiva |
| `components/ui/ActionBar.module.css` | Novo | Estilos do ActionBar |
| `components/ui/DataTable.tsx` | Modificado | Adicionado scrollY, defaultEllipsis |
| `app/globals.css` | Modificado | Max-width limitado, modo compact |

---

## 8. Fase 2 - Páginas Críticas (CONCLUÍDA)

### 8.1 Cotação - VolumesGrid
**Arquivo:** `components/quote/VolumesGrid.tsx`

**Alteração:** Grid responsivo para campos de volume
- Antes: `xs={12}` (2 colunas em mobile)
- Depois: `xs={24} sm={12} md={6}` (1 coluna mobile, 2 tablet, 4 desktop)

### 8.2 Cotação - QuoteResultsSection
**Arquivo:** `components/quote/QuoteResultsSection.tsx`

**Alterações:**
- Migrado de `Table` antd para `DataTable` com suporte mobile cards
- Migrado de `Modal` antd para `ELModal`
- Migrado de `Modal.warning()` para `modal.warning()` via App.useApp()
- Adicionado propriedades mobile (`showInCard`, `cardLabel`) nas colunas

### 8.3 ELGrid Variant Finalizar
**Arquivo:** `components/ui/ELGrid.module.css`

**Status:** Já estava responsivo com breakpoints adequados
- Desktop: Grid 24 colunas (10/8/6)
- 1366px: 2 colunas (1/1/2 spans)
- 1024px e menor: 1 coluna

### 8.4 Shipments - ActionBar
**Arquivo:** `app/(envio)/shipments/ShipmentsClient.tsx`

**Alterações:**
- Substituído `filterBar` manual por `ActionBar` component
- Adicionado `scrollY="calc(100vh - 340px)"` no DataTable
- Botão "Atualizar" movido para extraActions do ActionBar

### 8.5 Coletas - ActionBar
**Arquivo:** `app/(envio)/coletas/ColetasClient.tsx`

**Alterações:**
- Substituído `filterBar` manual por `ActionBar` component
- Adicionado `scrollY="calc(100vh - 340px)"` no DataTable
- Ajustado min-width do RangePicker de 240px para 220px

### 8.6 Extrato - ActionBar
**Arquivos:**
- `app/(envio)/carteira/extrato/ExtratoClient.tsx`
- `components/wallet/StatementTable.tsx`

**Alterações:**
- Substituído `filterBar` manual por `ActionBar variant="compact"`
- Adicionado `scrollY="calc(100vh - 400px)"` no StatementTable

### 8.7 Admin/Collector - Sidebar Responsivo
**Arquivos:**
- `app/(admin)/admin/layout.tsx`
- `app/(collector)/collector/CollectorLayoutClient.tsx`

**Alterações Admin:**
- Adicionado hook `useIsSmallDesktop()` para detectar 1366px
- Sidebar dinâmica: 200px em 1366px, 240px em desktop normal
- Transição suave na mudança de largura

**Alterações Collector:**
- Adicionado hooks `useIsMobile()` e `useIsSmallDesktop()`
- Implementado mobile Drawer (antes não tinha suporte mobile)
- Sidebar dinâmica: 200px em 1366px, 240px em desktop normal
- Header responsivo com menu hamburger no mobile
- Padding de conteúdo ajustado: 16px mobile, 24px desktop

---

## 9. Arquivos Modificados (Fase 2)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `components/quote/VolumesGrid.tsx` | Modificado | Grid responsivo xs=24/sm=12/md=6 |
| `components/quote/QuoteResultsSection.tsx` | Modificado | Migrado para DataTable + ELModal |
| `app/(envio)/shipments/ShipmentsClient.tsx` | Modificado | ActionBar + scrollY |
| `app/(envio)/coletas/ColetasClient.tsx` | Modificado | ActionBar + scrollY |
| `app/(envio)/carteira/extrato/ExtratoClient.tsx` | Modificado | ActionBar compact |
| `components/wallet/StatementTable.tsx` | Modificado | scrollY adicionado |
| `app/(admin)/admin/layout.tsx` | Modificado | Sidebar responsiva 200/240px |
| `app/(collector)/collector/CollectorLayoutClient.tsx` | Modificado | Mobile drawer + sidebar responsiva |

---

## 10. Fase 4/5/6 - Rotas (envio/admin/collector) (CONCLUÍDA)

### 10.1 Rotas (envio)

**Etiquetas:**
- `components/labels/LabelsTable.tsx` - Adicionado ActionBar + scrollY
- `app/(envio)/etiquetas/EtiquetasClient.tsx` - ELModal com size="md"

**Carteira:**
- `app/(envio)/carteira/metodos/MetodosClient.tsx` - Migrado Modal→ELModal, Space→ActionBar
- `app/(envio)/carteira/faturas/FaturasClient.tsx` - Adicionado scrollY

**Rastreamento:**
- `app/(envio)/rastreamento/RastreamentoClient.tsx` - Substituído filterBar por ActionBar, scrollY

### 10.2 Rotas (admin)

**Tabelas principais:**
- `components/admin/users/UsersTable.tsx` - scroll y adicionado
- `components/collectors/CollectorsTable.tsx` - scroll x/y adicionado
- `components/pickup/PointsTable.tsx` - scroll x/y adicionado
- `components/admin/finance/WalletTransactionsTable.tsx` - scroll y adicionado
- `components/admin/finance/CarrierPayoutsTable.tsx` - scroll y adicionado

**Operações (todas as tabs):**
- `components/admin/ops/ShipmentsTable.tsx` - scroll y adicionado
- `components/admin/ops/PickupsTable.tsx` - scroll y adicionado
- `components/admin/ops/ReceptionsTable.tsx` - scroll y adicionado
- `components/admin/ops/ExceptionsTable.tsx` - scroll y adicionado
- `components/admin/ops/EventsTable.tsx` - scroll y adicionado

### 10.3 Rotas (collector)

- `app/(collector)/collector/receptions/ReceptionsClient.tsx` - scroll x/y adicionado
- `app/(collector)/collector/CollectorDashClient.tsx` - scroll x adicionado

---

## 11. Fase 7/8/9 - Rotas (public/auth/componentes) (CONCLUÍDA)

### 11.1 Rotas (public) - Coletor Autônomo

**Layout:**
- `app/(public)/coletores/ColetoresLayoutClient.tsx` - Mobile drawer + sidebar responsiva 200/240px + hooks useIsMobile/useIsSmallDesktop

**Tabelas:**
- `app/(public)/coletores/coletas/ColetasColetorClient.tsx` - scroll y adicionado
- `app/(public)/coletores/coletas-realizadas/ColetasRealizadasClient.tsx` - scroll y adicionado

### 11.2 Rotas (auth)

As páginas de auth já usavam estrutura responsiva centralizada com CSS modules:
- Login, Cadastro, Forgot Password, Reset Password, Verify Email

### 11.3 Componentes Compartilhados

- `components/cotacoes/ModalNovaEmbalagem.tsx` - Migrado Modal antd → ELModal

---

## 12. Fase 3 - Refino Final (CONCLUÍDA)

### 12.1 Migração de Modals antd → ELModal

**Arquivos migrados (16+ componentes):**

| Arquivo | Alteração |
|---------|-----------|
| `components/recipients/RecipientModal.tsx` | Modal → ELModal size="md" |
| `components/account/CardModal.tsx` | Modal → ELModal size="md" |
| `components/account/AddressModal.tsx` | Modal → ELModal size="md" |
| `components/quote/ContentDeclarationModal.tsx` | Modal → ELModal size="sm" |
| `components/wallet/CardPaymentForm.tsx` | Modal → ELModal size="sm" |
| `components/wallet/SavedCardPaymentForm.tsx` | Modal → ELModal size="sm" |
| `app/(public)/coletores/suporte/SuporteClient.tsx` | Modal → ELModal size="md" |
| `components/admin/EmailConfigForm.tsx` | Modal → ELModal size="sm" |
| `components/admin/finance/WalletTransactionsTable.tsx` | Modal → ELModal size="md" |
| `app/(public)/coletores/coletas/ColetasColetorClient.tsx` | Modal → ELModal size="md" |
| `app/(public)/coletores/coletas-realizadas/ColetasRealizadasClient.tsx` | Modal → ELModal size="sm" |
| `components/admin/finance/LedgerTable.tsx` | Modal → ELModal size="sm" |
| `components/admin/finance/PayoutsTable.tsx` | Modal → ELModal size="sm" |
| `components/admin/finance/ExpensesTable.tsx` | Modal → ELModal size="lg" |
| `app/(collector)/collector/receptions/ReceptionsClient.tsx` | Modal → ELModal size="md" |
| `components/admin/ops/ExceptionsTable.tsx` | Modal → ELModal size="md" |
| `components/admin/clients/AdminClientWallet.tsx` | Modal → ELModal size="sm" |
| `components/admin/clients/AdminClientRecurringItems.tsx` | Modal → ELModal size="md" |
| `components/quote/MapModal.tsx` | Modal → ELModal size="lg" |
| `components/wallet/ResolveDebtModal.tsx` | Modal → ELModal size="md" |
| `components/admin/clients/AdminClientRecipients.tsx` | Modal → ELModal size="lg" |
| `components/admin/clients/AdminClientAddresses.tsx` | Modal → ELModal size="md" |

### 12.2 Migração de Modal.confirm() → App.useApp().modal.confirm()

**Arquivos migrados:**

| Arquivo | Descrição |
|---------|-----------|
| `components/admin/users/UsersTable.tsx` | Confirmação de exclusão de usuário |
| `components/collectors/CollectorsTable.tsx` | Confirmações de status e exclusão |
| `components/pickup/PointsTable.tsx` | Confirmações de status e exclusão |
| `components/collectors/CollectorDrawer.tsx` | Confirmação de reset de senha |

### 12.3 Tabelas com scrollY adicionado (Fase 3)

**Arquivos atualizados:**

| Arquivo | scrollY |
|---------|---------|
| `components/admin/finance/InvoicesTable.tsx` | calc(100vh - 480px) |
| `components/admin/finance/ChargebacksTable.tsx` | calc(100vh - 480px) |
| `components/admin/finance/CommissionsTable.tsx` | calc(100vh - 480px) |
| `components/admin/finance/ReconciliationTable.tsx` | calc(100vh - 480px) |
| `components/admin/finance/ExpensesTable.tsx` | calc(100vh - 480px) |
| `components/admin/finance/AccountsPayableTable.tsx` | calc(100vh - 520px) |
| `components/admin/finance/PayoutsTable.tsx` | calc(100vh - 480px) |
| `components/admin/finance/LedgerTable.tsx` | calc(100vh - 480px) |
| `components/admin/finance/DRETable.tsx` | calc(100vh - 380px) |
| `components/admin/ops/PoCTable.tsx` | calc(100vh - 340px) |
| `components/admin/clients/ClientsTable.tsx` | calc(100vh - 400px) |
| `components/coletas/ColetasTable.tsx` | calc(100vh - 400px) |
| `components/admin/finance/ProfileCommissionsTable.tsx` | calc(100vh - 380px) (ambas tabelas) |

### 12.4 Migração de Drawers antd → ELDrawer

**Arquivos migrados (4 drawers de formulário):**

| Arquivo | width → drawerSize |
|---------|-------------------|
| `components/pickup/PointDrawer.tsx` | 720 → xl |
| `components/admin/users/UserDrawer.tsx` | 600 → lg |
| `components/coletas/ColetaDetailDrawer.tsx` | 600 → lg |
| `components/collectors/CollectorDrawer.tsx` | 760 → xl |

**Nota:** Os drawers de navegação mobile (MobileDrawer, layouts) NÃO foram migrados pois usam width: 280px específico para menus mobile, menor que o tamanho mínimo do ELDrawer (sm: 320px).

---

## 13. Arquivos Modificados (Fase 3)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `components/recipients/RecipientModal.tsx` | Modificado | Modal → ELModal |
| `components/account/CardModal.tsx` | Modificado | Modal → ELModal |
| `components/account/AddressModal.tsx` | Modificado | Modal → ELModal |
| `components/quote/ContentDeclarationModal.tsx` | Modificado | Modal → ELModal |
| `components/wallet/CardPaymentForm.tsx` | Modificado | Modal → ELModal |
| `components/wallet/SavedCardPaymentForm.tsx` | Modificado | Modal → ELModal |
| `app/(public)/coletores/suporte/SuporteClient.tsx` | Modificado | Modal → ELModal |
| `components/admin/EmailConfigForm.tsx` | Modificado | Modal → ELModal |
| `components/admin/finance/*.tsx` (vários) | Modificado | Modal → ELModal, scrollY |
| `components/admin/clients/*.tsx` (vários) | Modificado | Modal → ELModal |
| `components/admin/ops/*.tsx` (vários) | Modificado | scrollY |
| `components/pickup/PointDrawer.tsx` | Modificado | Drawer → ELDrawer |
| `components/admin/users/UserDrawer.tsx` | Modificado | Drawer → ELDrawer |
| `components/coletas/ColetaDetailDrawer.tsx` | Modificado | Drawer → ELDrawer |
| `components/collectors/CollectorDrawer.tsx` | Modificado | Drawer → ELDrawer |
| `components/admin/users/UsersTable.tsx` | Modificado | Modal.confirm → modal.confirm |
| `components/collectors/CollectorsTable.tsx` | Modificado | Modal.confirm → modal.confirm |
| `components/pickup/PointsTable.tsx` | Modificado | Modal.confirm → modal.confirm |

---

## 14. Arquivos Modificados (Fase 7/8/9)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `app/(public)/coletores/ColetoresLayoutClient.tsx` | Modificado | Mobile drawer + sidebar responsiva |
| `app/(public)/coletores/coletas/ColetasColetorClient.tsx` | Modificado | scroll y |
| `app/(public)/coletores/coletas-realizadas/ColetasRealizadasClient.tsx` | Modificado | scroll y |
| `components/cotacoes/ModalNovaEmbalagem.tsx` | Modificado | Modal → ELModal |

---

## 15. Arquivos Modificados (Fase 4/5/6)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `components/labels/LabelsTable.tsx` | Modificado | ActionBar + scrollY |
| `app/(envio)/etiquetas/EtiquetasClient.tsx` | Modificado | ELModal size="md" |
| `app/(envio)/carteira/metodos/MetodosClient.tsx` | Modificado | Modal→ELModal, Space→ActionBar |
| `app/(envio)/carteira/faturas/FaturasClient.tsx` | Modificado | scrollY adicionado |
| `app/(envio)/rastreamento/RastreamentoClient.tsx` | Modificado | ActionBar + scrollY |
| `components/admin/users/UsersTable.tsx` | Modificado | scroll y adicionado |
| `components/collectors/CollectorsTable.tsx` | Modificado | scroll x/y |
| `components/pickup/PointsTable.tsx` | Modificado | scroll x/y |
| `components/admin/finance/WalletTransactionsTable.tsx` | Modificado | scroll y |
| `components/admin/finance/CarrierPayoutsTable.tsx` | Modificado | scroll y |
| `components/admin/ops/ShipmentsTable.tsx` | Modificado | scroll y |
| `components/admin/ops/PickupsTable.tsx` | Modificado | scroll y |
| `components/admin/ops/ReceptionsTable.tsx` | Modificado | scroll y |
| `components/admin/ops/ExceptionsTable.tsx` | Modificado | scroll y |
| `components/admin/ops/EventsTable.tsx` | Modificado | scroll y |
| `app/(collector)/collector/receptions/ReceptionsClient.tsx` | Modificado | scroll x/y |
| `app/(collector)/collector/CollectorDashClient.tsx` | Modificado | scroll x |

---

## 16. Critérios de Aceite

1. **1366x768**: Nenhum overflow horizontal; modais com max-height; tabelas com scroll.x e células compactas
2. **Mobile 360x640**: Sem scroll horizontal; tabelas em modo card; formulários 1 coluna
3. **Ultrawide 3440x1440**: Conteúdo limitado a 1600px; fundo preenchido, não o conteúdo
4. **Consistência visual**: Mesma aparência entre remetente/admin/collector

---

## 17. Notas Importantes

- O modo compact é ativado automaticamente via media query `@media (max-height: 800px)`
- A classe `.el-compact` pode ser usada para forçar modo compact
- O container global `.el-container` foi atualizado, mas o novo `AppContainer` é preferível para novos desenvolvimentos
- O DataTable agora aplica ellipsis por padrão - use `ellipsis: false` na coluna se não desejado
- Admin/Collector layouts agora têm sidebar responsiva (200px em 1366, 240px normal)
- Collector layout agora tem suporte completo a mobile com drawer navigation
- **Todos os Modals** agora usam `ELModal` com prop `size` (sm/md/lg)
- **Todos os Drawers de formulário** agora usam `ELDrawer` com prop `drawerSize` (sm/md/lg/xl)
- Drawers de navegação mobile mantêm Drawer antd com width: 280px (específico para menus)

---

## 18. Próximos Passos (TODO)

- [ ] Criar FormRow helper para formulários responsivos
- [ ] Adicionar testes visuais (Playwright/Percy)
- [ ] Revisar componentes dashboard que ainda usam Card antd direto

---

## 19. Status Final

| Fase | Status | Descrição |
|------|--------|-----------|
| Fase 1 | ✅ Concluída | Global (container + tokens + ajustes base) |
| Fase 2 | ✅ Concluída | Páginas críticas (cotação, shipments, coletas) |
| Fase 3 | ✅ Concluída | Refino final (Modals, Drawers, scrollY) |
| Fase 4/5/6 | ✅ Concluída | Rotas envio/admin/collector |
| Fase 7/8/9 | ✅ Concluída | Rotas public/auth/componentes |

**Build:** ✅ Passou com sucesso (201 páginas geradas)

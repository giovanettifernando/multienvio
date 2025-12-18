# Auditoria Completa de UI/UX + Plano de Ação
## Envio Legal - Aplicação Principal (Remetente)

**Data:** 2025-01-XX  
**Escopo:** Aplicação principal (remetente) - `app/(envio)/**`  
**Stack:** Next.js App Router, Ant Design 6, CSS Modules, Tokens CSS

---

## 1. Inventário de Telas/Rotas e Padrões

### 1.1 Rotas Principais e Layouts

| Rota | Arquivo | Layout | Componentes Principais | Problemas de Responsividade |
|------|---------|--------|------------------------|------------------------------|
| `/` (Dashboard) | `app/(envio)/(overview)/OverviewClient.tsx` | `PageShell` + `ELGrid` | Cards de status, QuickCalculator, WalletCard, SupportQuickView | Grids sem max-width em telas grandes; cards esticam demais |
| `/cotacoes` | `app/(envio)/cotacoes/CotacoesClient.tsx` | `PageShell` | Formulário de cotação, QuoteResultCard | Formulário sem container; resultados sem limite de largura |
| `/cotacoes/finalizar` | `app/(envio)/cotacoes/finalizar/FinalizarClient.tsx` | `PageShell` | `Row/Col` (AntD), Cards, Forms | **CRÍTICO:** `Row/Col` com `gutter={[16,16]}` e `gutter={[24,24]}` esticam em ultrawide; sem max-width |
| `/carrinho` | `app/(envio)/carrinho/CarrinhoClient.tsx` | `PageShell` | `Row/Col` (AntD), CartTable, CartSummary | Grid 16/8 sem max-width; tabela estica em telas grandes |
| `/shipments` | `app/(envio)/shipments/ShipmentsClient.tsx` | `PageShell` | `DataTable`, filtros, modais | Tabela sem max-width; colunas muito largas em ultrawide |
| `/coletas` | `app/(envio)/coletas/ColetasClient.tsx` | `PageShell` | `DataTable` | Mesmo problema de tabelas |
| `/carteira` | `app/(envio)/carteira/CarteiraClient.tsx` | `PageShell` | Cards, WalletCard | Cards sem limite de largura |
| `/carteira/extrato` | `app/(envio)/carteira/extrato/ExtratoClient.tsx` | `PageShell` | `DataTable` | Tabela estica |
| `/carteira/faturas` | `app/(envio)/carteira/faturas/FaturasClient.tsx` | `PageShell` | `DataTable` | Tabela estica |
| `/suporte` | `app/(envio)/suporte/SuporteClient.tsx` | `PageShell` | `Card` (AntD direto), `NewTicketList` | **INCONSISTÊNCIA:** Usa `Card` do AntD com `padding: 24` fixo em vez de `ELCard` |
| `/etiquetas` | `app/(envio)/etiquetas/EtiquetasClient.tsx` | `PageShell` | `DataTable`, modais | Tabela estica |
| `/minha-conta` | `app/(envio)/minha-conta/MinhaContaClient.tsx` | `PageShell` | `ELGrid`, formulários | Grid funciona, mas conteúdo interno pode esticar |
| `/rastreamento` | `app/(envio)/rastreamento/RastreamentoClient.tsx` | `PageShell` | `DataTable` | Tabela estica |
| `/rastreio/[code]` (público) | `app/rastreio/[code]/page.tsx` | Sem `PageShell` | Cards, ELStatusTag | Container simples sem max-width; tipografia fixa |

### 1.2 Padrões de Layout Identificados

#### Layout Base (`DashboardShell`)
- **Arquivo:** `components/layout/dashboard-shell.tsx`
- **Problema crítico:** Sem `max-width` no container de conteúdo
- **Comportamento atual:**
  ```tsx
  <Content style={{ padding: isMobile ? '16px' : '0 24px 24px' }}>
    {children}  // Sem limite de largura
  </Content>
  ```
- **Impacto:** Em telas ≥1600px, conteúdo estica até as bordas da tela, criando linhas de texto muito longas e componentes desproporcionais.

#### PageShell
- **Arquivo:** `components/shared/PageShell.tsx` + `PageShell.module.css`
- **Problema:** Header sticky com `margin-left/right: calc(-1 * var(--el-spacing-xl))` cria faixa azul que se estende além do container em telas grandes
- **Sem max-width:** Conteúdo interno não tem limite de largura

#### Grids
- **ELGrid:** Funciona bem, mas falta container com max-width
- **Row/Col (AntD):** Ainda usado em `/cotacoes/finalizar` e `/carrinho` com gutters fixos que não escalam

---

## 2. Diagnóstico de Responsividade

### 2.1 Breakpoints Atuais (Inconsistentes)

| Breakpoint | Onde é usado | Problema |
|------------|--------------|----------|
| `768px` | DataTable, PageShell, ELGrid, Sidebar | Padrão mobile, mas inconsistente (alguns usam 767px) |
| `1024px` | ELGrid (grid4, gridDashboard) | Tablet, mas não cobre todos os casos |
| `991px` | Sidebar (tooltips) | Valor arbitrário |
| `480px` | Labels modal | Muito específico |

**Problema:** Não há breakpoints para telas grandes (≥1600px, 1920px, 2560px).

### 2.2 Breakpoints Recomendados

```css
/* Sistema de breakpoints unificado */
--breakpoint-xs: 0px;        /* Mobile pequeno */
--breakpoint-sm: 576px;       /* Mobile grande */
--breakpoint-md: 768px;       /* Tablet */
--breakpoint-lg: 1024px;      /* Desktop pequeno */
--breakpoint-xl: 1280px;      /* Desktop comum */
--breakpoint-2xl: 1536px;     /* Desktop grande */
--breakpoint-3xl: 1920px;     /* Ultrawide */
```

**Justificativa:**
- `xs/sm/md/lg`: Padrão Tailwind/antd, cobre mobile/tablet
- `xl (1280px)`: Desktop comum (1366x768, 1280x720)
- `2xl (1536px)`: Desktop grande (1920x1080 em zoom, 1600x900)
- `3xl (1920px)`: Ultrawide (1920x1080, 2560x1440)

### 2.3 Max-Width de Container por Breakpoint

| Breakpoint | Max-Width | Justificativa |
|------------|-----------|---------------|
| `< 768px` | 100% (sem padding lateral excessivo) | Mobile full-width |
| `768px - 1023px` | 100% (padding 16px) | Tablet |
| `1024px - 1279px` | 1200px | Desktop pequeno - conteúdo centralizado |
| `1280px - 1535px` | 1400px | Desktop comum - área de leitura confortável |
| `1536px - 1919px` | 1600px | Desktop grande - evita esticamento |
| `≥ 1920px` | 1800px | Ultrawide - máximo confortável para leitura |

**Implementação sugerida:**
```css
.container {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0 var(--el-spacing-lg);
}

@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    padding: 0 var(--el-spacing-xl);
  }
}

@media (min-width: 1280px) {
  .container {
    max-width: 1400px;
  }
}

@media (min-width: 1536px) {
  .container {
    max-width: 1600px;
  }
}

@media (min-width: 1920px) {
  .container {
    max-width: 1800px;
  }
}
```

### 2.4 Comportamento de Componentes por Breakpoint

#### Tabelas (DataTable)
- **< 768px:** Card mode (já implementado)
- **768px - 1023px:** Tabela com scroll horizontal + algumas colunas ocultas
- **≥ 1024px:** Tabela completa, mas com max-width do container
- **≥ 1920px:** Tabela centralizada, não estica além de 1800px

#### Modais
- **< 768px:** Fullscreen ou quase fullscreen (width: calc(100vw - 32px))
- **768px - 1023px:** width: 90vw, max-width: 600px
- **≥ 1024px:** width: 600px - 800px (dependendo do tipo)
- **≥ 1920px:** Não aumenta além de 800px (centralizado)

#### Sidebar
- **< 768px:** Drawer (já implementado)
- **≥ 768px:** Sidebar fixa 280px (colapsa para 80px)
- **≥ 1920px:** Mantém 280px (não aumenta)

#### Grids (ELGrid)
- **< 768px:** 1 coluna (já implementado)
- **768px - 1023px:** 2 colunas para grid4, 1 coluna para gridDashboard
- **≥ 1024px:** Grid completo, mas respeitando max-width do container
- **≥ 1920px:** Grid não estica além do container

### 2.5 Anti-Patterns Identificados

#### 1. Width 100% em Containers Sem Limite
**Arquivos afetados:**
- `components/layout/dashboard-shell.tsx` (Content sem max-width)
- `components/shared/PageShell.module.css` (shell sem max-width)
- Todas as páginas que usam `PageShell`

**Solução:** Adicionar container com max-width no `DashboardShell` ou criar wrapper.

#### 2. Uso Inconsistente de Flex/Grid
**Arquivos:**
- `/cotacoes/finalizar`: `Row/Col` com gutters fixos
- `/carrinho`: `Row/Col` com gutters fixos
- `/overview`: `ELGrid` (correto, mas sem container)

**Solução:** Migrar `Row/Col` para `ELGrid` e adicionar container.

#### 3. Valores Fixos de px que Quebram
**Exemplos:**
- `Card` em `/suporte` com `padding: 24` fixo
- `gutter={[24, 24]}` em `Row/Col`
- `width: 140` no logo mobile

**Solução:** Usar tokens CSS (`var(--el-spacing-xl)`).

#### 4. Tipografia Sem Escala
**Problema:** Tamanhos fixos (`font-size: 20px`, `font-size: 24px`) não escalam em telas grandes.

**Solução:** Usar `clamp()` ou tokens com escala responsiva:
```css
.title {
  font-size: clamp(18px, 2vw, 24px);
}
```

---

## 3. Padronização Visual (Design Tokens)

### 3.1 Tokens Existentes (app/globals.css)

**Espaçamentos:**
```css
--el-spacing-xs: 4px;
--el-spacing-sm: 8px;
--el-spacing-md: 12px;
--el-spacing-lg: 16px;
--el-spacing-xl: 24px;
--el-spacing-xxl: 32px;
```
✅ **Status:** Bem definidos, mas falta `48px`, `64px` para telas grandes.

**Radius:**
```css
--el-radius-base: 12px;
--el-radius-sm: 8px;
--el-radius-lg: 16px;
```
✅ **Status:** Suficiente.

**Tipografia:**
```css
--el-font-size-xs: 12px;
--el-font-size-sm: 13px;
--el-font-size-base: 16px;
--el-font-size-lg: 18px;
--el-font-size-xl: 20px;
--el-font-size-2xl: 24px;
--el-font-size-3xl: 28px;
--el-font-size-4xl: 32px;
```
⚠️ **Problema:** Tamanhos fixos não escalam. Falta escala responsiva.

**Line-height:**
```css
--el-line-height-tight: 1.25;
--el-line-height-base: 1.5;
--el-line-height-relaxed: 1.75;
```
✅ **Status:** Adequado.

### 3.2 Tokens Propostos (Adicionar)

#### Espaçamentos Adicionais
```css
--el-spacing-3xl: 48px;  /* Para gaps grandes em telas grandes */
--el-spacing-4xl: 64px;  /* Para seções com muito espaço */
```

#### Layout Max-Width (Novo)
```css
--el-container-max-width-xs: 100%;
--el-container-max-width-sm: 100%;
--el-container-max-width-md: 100%;
--el-container-max-width-lg: 1200px;
--el-container-max-width-xl: 1400px;
--el-container-max-width-2xl: 1600px;
--el-container-max-width-3xl: 1800px;
```

#### Tipografia Responsiva (Usar clamp)
```css
/* Títulos */
--el-font-size-h1: clamp(28px, 3vw, 36px);
--el-font-size-h2: clamp(24px, 2.5vw, 32px);
--el-font-size-h3: clamp(20px, 2vw, 24px);
--el-font-size-h4: clamp(18px, 1.5vw, 20px);
--el-font-size-h5: clamp(16px, 1.2vw, 18px);

/* Corpo */
--el-font-size-body: clamp(14px, 1vw, 16px);
--el-font-size-small: clamp(12px, 0.9vw, 13px);
```

### 3.3 Onde Aplicar Tokens

#### Ant Design Theme (lib/ui/theme.ts)
- Já tem tokens básicos
- **Adicionar:** Tokens de container max-width (via CSS vars, não via AntD)

#### CSS Variables (app/globals.css)
- **Adicionar:** Tokens de container, tipografia responsiva
- **Manter:** Tokens existentes de cores, espaçamentos, radius

#### Componentes
- **ELGrid:** Já usa tokens de gap ✅
- **PageShell:** Usa tokens de spacing ✅
- **DataTable:** Usa tokens de padding ✅
- **Cards (AntD direto):** ❌ Não usa tokens (ex: `/suporte`)

### 3.4 Divergências Atuais e Correções

| Componente | Uso Atual | Deveria Usar | Arquivo |
|------------|-----------|--------------|---------|
| Card em `/suporte` | `padding: 24` fixo | `ELCard` com `padding="lg"` | `app/(envio)/suporte/SuporteClient.tsx` |
| Row/Col em `/cotacoes/finalizar` | `gutter={[16,16]}` fixo | `ELGrid` com `gap="md"` | `app/(envio)/cotacoes/finalizar/FinalizarClient.tsx` |
| Row/Col em `/carrinho` | `gutter={[24,24]}` fixo | `ELGrid` com `gap="lg"` | `app/(envio)/carrinho/CarrinhoClient.tsx` |
| Container em `DashboardShell` | Sem max-width | Container com max-width responsivo | `components/layout/dashboard-shell.tsx` |
| Header em `PageShell` | Margin negativo sem limite | Container interno ou max-width | `components/shared/PageShell.module.css` |

---

## 4. Componentes a Consolidar

### 4.1 Botões

**Status:** ✅ Já consolidado em `ELButton`  
**Uso:** Amplamente adotado  
**Variações:** primary, default, danger, link, ghost  
**Altura:** 44px (padronizado via AntD theme)

**Arquivos que ainda podem ter botões AntD diretos:**
- Verificar páginas públicas (`app/rastreio/[code]`)
- Componentes legados em `components/quote/**`

### 4.2 Inputs/Selects/Date Pickers

**Status:** ✅ Consolidado em `ELInput`, `ELSelect`, `ELFormItem`  
**Altura:** 44px (padronizado)  
**Uso:** Formulários principais já migrados

**Verificar:**
- Formulários em `/cotacoes` e `/cotacoes/finalizar` (já devem estar usando)

### 4.3 Cards

**Problema:** Duplicidade entre `ELCard` e `Card` do AntD

| Componente | Onde é usado | Deveria usar |
|------------|--------------|-------------|
| `ELCard` | Dashboard, algumas páginas | ✅ Padrão |
| `Card` (AntD direto) | `/suporte`, `/cotacoes/finalizar` (alguns), componentes legados | ❌ Migrar para `ELCard` |

**Arquivos a migrar:**
- `app/(envio)/suporte/SuporteClient.tsx` (linhas 46, 51)
- Verificar outros usos de `Card` do AntD em `app/(envio)/**`

**Proposta:** Criar script de busca e substituição, ou migrar manualmente página por página.

### 4.4 Modais

**Status:** ✅ Consolidado em `ELModal`  
**Uso:** Pagamentos, etiquetas, faturas, divergências  
**Largura:** Variável (600px - 800px dependendo do tipo)

**Verificar:**
- Modais legados que ainda usam `Modal` do AntD direto

### 4.5 Tabelas

**Status:** ✅ Consolidado em `DataTable`  
**Uso:** Shipments, Coletas, Rastreamento, Etiquetas, Extrato, Faturas  
**Card mode:** ✅ Implementado para mobile  
**Problema:** Sem max-width do container, estica em telas grandes

**Arquivos que ainda podem ter tabelas AntD diretas:**
- Verificar componentes em `components/quote/**`
- Verificar componentes em `components/dashboard/**`

### 4.6 Resumo de Consolidação

| Componente | Fonte da Verdade | Onde Aparecem Variações | Ação |
|------------|------------------|-------------------------|------|
| Botões | `ELButton` | Páginas públicas, componentes legados | Buscar e migrar |
| Inputs | `ELInput`, `ELSelect` | ✅ Já consolidado | - |
| Cards | `ELCard` | `/suporte`, alguns em `/cotacoes/finalizar` | Migrar para `ELCard` |
| Modais | `ELModal` | ✅ Já consolidado | - |
| Tabelas | `DataTable` | Componentes legados | Verificar e migrar se necessário |

---

## 5. Plano de Execução por Fases

### Fase 1: Correções de Container/Max-Width + Grids + Tipografia Base
**Duração estimada:** 2-3 dias  
**Prioridade:** 🔴 Crítica  
**Risco:** Baixo (não quebra funcionalidades)

#### Checklist

- [ ] **1.1 Criar sistema de container com max-width**
  - [ ] Adicionar tokens CSS de max-width em `app/globals.css`
  - [ ] Criar componente `Container` ou classe CSS `.container`
  - [ ] Aplicar em `DashboardShell` (wrapper do Content)
  - [ ] Testar em 1920px, 2560px

- [ ] **1.2 Corrigir PageShell header**
  - [ ] Remover margin negativo ou aplicar max-width no header
  - [ ] Garantir que header não estica além do container
  - [ ] Testar sticky behavior

- [ ] **1.3 Migrar Row/Col para ELGrid**
  - [ ] `/cotacoes/finalizar`: Substituir `Row/Col` por `ELGrid`
  - [ ] `/carrinho`: Substituir `Row/Col` por `ELGrid`
  - [ ] Verificar outros usos de `Row/Col` em `app/(envio)/**`
  - [ ] Testar responsividade

- [ ] **1.4 Aplicar tipografia responsiva (opcional, pode ser Fase 3)**
  - [ ] Adicionar tokens de tipografia com `clamp()` em `globals.css`
  - [ ] Aplicar em títulos principais (h1, h2, h3)
  - [ ] Testar escalabilidade

#### Arquivos a Modificar

1. `app/globals.css` - Adicionar tokens de container
2. `components/layout/dashboard-shell.tsx` - Adicionar container wrapper
3. `components/shared/PageShell.module.css` - Corrigir header
4. `app/(envio)/cotacoes/finalizar/FinalizarClient.tsx` - Migrar Row/Col
5. `app/(envio)/carrinho/CarrinhoClient.tsx` - Migrar Row/Col

#### Riscos e Mitigações

- **Risco:** Container pode quebrar layouts existentes  
  **Mitigação:** Testar em todas as páginas principais, usar feature flag se necessário

- **Risco:** ELGrid pode ter comportamento diferente de Row/Col  
  **Mitigação:** Testar side-by-side, ajustar gaps se necessário

---

### Fase 2: Padronização de Componentes e Remoção de Duplicidade
**Duração estimada:** 3-4 dias  
**Prioridade:** 🟡 Alta  
**Risco:** Médio (pode afetar estilos visuais)

#### Checklist

- [ ] **2.1 Migrar Cards do AntD para ELCard**
  - [ ] `/suporte`: Substituir `Card` por `ELCard`
  - [ ] Buscar outros usos de `Card` do AntD em `app/(envio)/**`
  - [ ] Verificar padding/gaps estão corretos
  - [ ] Testar visualmente

- [ ] **2.2 Padronizar modais**
  - [ ] Verificar larguras de modais (usar tokens)
  - [ ] Garantir comportamento responsivo (fullscreen em mobile)
  - [ ] Centralizar modais em telas grandes

- [ ] **2.3 Padronizar toolbars de tabela**
  - [ ] Verificar filtros/botões em DataTable
  - [ ] Garantir que toolbars não esticam além do container
  - [ ] Testar em mobile

- [ ] **2.4 Buscar e migrar botões AntD diretos**
  - [ ] Buscar `Button` do AntD em `app/(envio)/**`
  - [ ] Migrar para `ELButton`
  - [ ] Verificar variantes (primary, default, etc.)

#### Arquivos a Modificar

1. `app/(envio)/suporte/SuporteClient.tsx` - Migrar Card
2. Buscar outros arquivos com `Card` do AntD
3. Verificar modais em `components/**`
4. Buscar `Button` do AntD em `app/(envio)/**`

#### Riscos e Mitigações

- **Risco:** ELCard pode ter estilos diferentes  
  **Mitigação:** Comparar visualmente, ajustar se necessário

- **Risco:** Migração de botões pode quebrar estilos  
  **Mitigação:** Testar cada página após migração

---

### Fase 3: Refinamentos (Microinterações, Estados Vazios, Loading, Validação Visual)
**Duração estimada:** 2-3 dias  
**Prioridade:** 🟢 Média  
**Risco:** Baixo (melhorias incrementais)

#### Checklist

- [ ] **3.1 Estados de loading padronizados**
  - [ ] Verificar se todos usam `ELSkeleton` ou spinner consistente
  - [ ] Padronizar tempo de loading (skeleton vs spinner)
  - [ ] Testar em todas as páginas

- [ ] **3.2 Estados vazios padronizados**
  - [ ] Verificar se todos usam `ELEmpty`
  - [ ] Padronizar mensagens e descrições
  - [ ] Testar visualmente

- [ ] **3.3 Validação visual de formulários**
  - [ ] Verificar se erros aparecem consistentemente
  - [ ] Padronizar cores de erro/sucesso
  - [ ] Testar em formulários principais

- [ ] **3.4 Microinterações**
  - [ ] Hover states em botões/cards
  - [ ] Transições suaves
  - [ ] Feedback visual em ações

- [ ] **3.5 Acessibilidade**
  - [ ] Verificar contraste de cores
  - [ ] Verificar foco visível
  - [ ] Testar com leitor de tela (básico)

#### Arquivos a Revisar

1. Todas as páginas em `app/(envio)/**` para estados de loading/empty
2. Formulários para validação visual
3. Componentes de UI para microinterações

#### Riscos e Mitigações

- **Risco:** Mudanças podem afetar UX existente  
  **Mitigação:** Testar com usuários ou revisar visualmente

---

## 6. Dependências Técnicas

### 6.1 Ant Design Theme
- **Arquivo:** `lib/ui/theme.ts`
- **Uso:** Tokens de componentes (Button, Input, etc.)
- **Não alterar:** Manter compatibilidade com AntD 6
- **Adicionar:** Apenas tokens de layout via CSS vars

### 6.2 CSS Variables
- **Arquivo:** `app/globals.css`
- **Uso:** Tokens de design (cores, espaçamentos, tipografia)
- **Adicionar:** Tokens de container max-width, tipografia responsiva

### 6.3 Componentes EL (Envio Legal)
- **Localização:** `components/ui/**`
- **Status:** Já consolidados
- **Não refatorar:** Manter estrutura atual

---

## 7. Métricas de Sucesso

### Responsividade
- ✅ Conteúdo não estica além de 1800px em telas ≥1920px
- ✅ Tabelas têm scroll horizontal ou colapsam colunas em mobile
- ✅ Modais são fullscreen ou quase fullscreen em mobile
- ✅ Grids colapsam para 1 coluna em mobile

### Consistência Visual
- ✅ Todos os Cards usam `ELCard`
- ✅ Todos os Botões usam `ELButton`
- ✅ Espaçamentos usam tokens CSS
- ✅ Tipografia usa escala responsiva (ou tokens fixos consistentes)

### Performance
- ✅ Sem regressões de performance
- ✅ CSS não aumenta significativamente (usar tokens, não duplicar estilos)

---

## 8. Próximos Passos Imediatos

1. **Revisar este documento** com a equipe
2. **Priorizar Fase 1** (correções críticas de responsividade)
3. **Criar branch** `fix/ui-responsiveness-phase1`
4. **Implementar container com max-width** (item 1.1)
5. **Testar em telas grandes** (1920px, 2560px)
6. **Migrar Row/Col** para ELGrid (itens 1.3)
7. **Testar todas as páginas** após mudanças

---

## 9. Notas Finais

- **Não alterar regras de negócio:** Apenas UI/UX
- **Não introduzir serviços de terceiros:** Manter stack atual
- **Não mudar stack de UI:** Manter Ant Design + CSS Modules
- **Foco em não quebrar:** Testar cada mudança antes de prosseguir
- **Documentar mudanças:** Atualizar este documento conforme progresso

---

**Documento gerado em:** 2025-01-XX  
**Última atualização:** 2025-01-XX  
**Próxima revisão:** Após conclusão da Fase 1


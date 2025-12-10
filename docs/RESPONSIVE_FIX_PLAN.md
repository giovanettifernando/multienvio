# Plano de Correção de Responsividade

## Análise do Estado Atual

### Arquitetura de Layout Existente
- **Stack**: Ant Design v6 + CSS Modules + CSS Variables (tokens)
- **Breakpoint principal**: 768px (mobile/desktop)
- **Sidebar**: 280px (expandida) / 80px (colapsada)
- **Container max-width**: 1200px → 1400px → 1600px → 1800px (progressivo)

### Pontos Positivos Identificados
- Sistema de tokens CSS bem definido (`globals.css`)
- Tipografia fluida com `clamp()`
- Grid system (`ELGrid`) com variantes responsivas
- Tabelas com modo card no mobile (`DataTable`)
- Modais com tamanhos variados (`ELModal`)

### Problemas Identificados

| Prioridade | Problema | Impacto |
|------------|----------|---------|
| CRÍTICO | Falta breakpoint tablet (768-1024px) | iPad portrait recebe mobile drawer |
| CRÍTICO | Container max-width muito conservador em 1366px | Conteúdo "apertado" |
| ALTO | Modal XL (1000px) apertado em 1366px | Margens mínimas |
| ALTO | Tabelas sem min-width em colunas | Colunas espremidas |
| MÉDIO | Altura de modais em 768px height | Scroll excessivo |
| MÉDIO | Grids não otimizados para 1366px | Proporções estranhas |
| BAIXO | Drawer mobile fixo 280px | Ocupa muito espaço em telas pequenas |

---

## Matriz de Testes por Resolução

### Mobile
| Resolução | Dispositivo | Status Atual |
|-----------|-------------|--------------|
| 360×640 | Android comum | A testar |
| 390×844 | iPhone 12/13 | A testar |
| 412×915 | Android grande | A testar |

### Tablet
| Resolução | Dispositivo | Status Atual |
|-----------|-------------|--------------|
| 768×1024 | iPad Portrait | Mobile drawer (problema) |
| 820×1180 | iPad Air | Mobile drawer (problema) |
| 1024×768 | Tablet Landscape | Desktop sidebar OK |

### Desktop Pequeno/Baixo (PRIORIDADE)
| Resolução | Dispositivo | Status Atual |
|-----------|-------------|--------------|
| 1366×768 | Notebook HD | Container 1200px (apertado) |
| 1280×720 | Notebook básico | Container 1200px |
| 1440×900 | MacBook Air 13" | Container 1200px |

### Desktop Comum
| Resolução | Dispositivo | Status Atual |
|-----------|-------------|--------------|
| 1536×864 | Notebook scaling | Container 1400px OK |
| 1600×900 | Desktop 16:9 | Container 1400px OK |
| 1920×1080 | Full HD | Container 1600px OK |

### Telas Grandes
| Resolução | Dispositivo | Status Atual |
|-----------|-------------|--------------|
| 2560×1440 | QHD | Container 1800px OK |
| 3440×1440 | Ultrawide | Container 1800px (muito estreito?) |

---

## Tarefas de Implementação

### Fase 1: Breakpoints e Container (Crítico)

#### 1.1 Adicionar breakpoint tablet (1024px)
**Arquivo**: `components/layout/dashboard-shell.tsx`
- Alterar lógica de `window.innerWidth < 768` para sistema de 3 níveis
- Mobile: < 768px (drawer)
- Tablet: 768px - 1023px (drawer ou sidebar compacta)
- Desktop: >= 1024px (sidebar)

#### 1.2 Otimizar container max-width para 1366px
**Arquivo**: `app/globals.css`
```css
/* Adicionar breakpoint específico */
@media (min-width: 1280px) and (max-width: 1439px) {
  .el-container {
    max-width: 1280px; /* Era 1200px, muito conservador */
  }
}

@media (min-width: 1440px) and (max-width: 1599px) {
  .el-container {
    max-width: 1360px; /* Era 1400px */
  }
}
```

#### 1.3 Revisar breakpoints globais
**Arquivo**: `app/globals.css`
- Documentar breakpoints oficiais
- Criar CSS custom properties para breakpoints

---

### Fase 2: Componentes Core

#### 2.1 Sidebar responsiva para tablet
**Arquivos**:
- `components/layout/Sidebar.tsx`
- `components/layout/Sidebar.module.css`
- Adicionar modo "compacto" para tablet (ícones apenas)
- Transição suave entre estados

#### 2.2 Modal sizing para resoluções baixas
**Arquivos**:
- `components/ui/ELModal.tsx`
- `components/ui/ELModal.module.css`
```css
/* Ajustar para 1366x768 */
@media (max-width: 1440px) {
  .el-modal-xl {
    max-width: 900px; /* Era 1000px */
  }
}

@media (max-height: 800px) {
  .el-modal-body {
    max-height: calc(100vh - 160px); /* Era 200px */
  }
}
```

#### 2.3 Tabelas com min-width inteligente
**Arquivos**:
- `components/ui/DataTable.tsx`
- `components/ui/DataTable.module.css`
- Adicionar prop `compactAt` para breakpoint customizado
- Definir min-width padrão por tipo de coluna

---

### Fase 3: Grids e Formulários

#### 3.1 Grid system para 1366px
**Arquivos**:
- `components/ui/ELGrid.tsx`
- `components/ui/ELGrid.module.css`
- Adicionar variante `gridDesktopSmall` para 1280-1440px
- Ajustar `gridForms` para não quebrar em 1366px

#### 3.2 Formulários responsivos
**Arquivos**: Diversos componentes de formulário
- Revisar FormCard para telas pequenas
- Ajustar Input/Select widths em grids

---

### Fase 4: Telas Grandes

#### 4.1 Ultrawide support
**Arquivo**: `app/globals.css`
```css
@media (min-width: 2560px) {
  .el-container {
    max-width: 2200px; /* Era 1800px, muito estreito */
  }
}

@media (min-width: 3440px) {
  .el-container {
    max-width: 2800px;
  }
}
```

#### 4.2 Content centering em telas muito grandes
- Evitar conteúdo "flutuando" com margens enormes
- Considerar layout multi-coluna para dashboards

---

### Fase 5: Testes e Refinamentos

#### 5.1 Testes visuais por resolução
- Criar checklist de telas para testar
- Documentar screenshots de cada resolução
- Ajustes finos baseados nos testes

#### 5.2 Performance
- Verificar se media queries não causam reflows excessivos
- Otimizar transições CSS

---

## Arquivos Principais a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `app/globals.css` | Breakpoints, containers, tokens |
| `components/layout/dashboard-shell.tsx` | Lógica de breakpoints |
| `components/layout/Sidebar.tsx` | Modo tablet |
| `components/layout/Sidebar.module.css` | Estilos tablet |
| `components/ui/ELModal.module.css` | Sizing responsivo |
| `components/ui/ELGrid.module.css` | Grids para 1366px |
| `components/ui/DataTable.module.css` | Min-widths, compact mode |

---

## Estimativa de Esforço

| Fase | Complexidade | Arquivos |
|------|--------------|----------|
| Fase 1 | Alta | 2-3 |
| Fase 2 | Alta | 4-6 |
| Fase 3 | Média | 3-4 |
| Fase 4 | Baixa | 1-2 |
| Fase 5 | Média | Testes |

---

## Riscos e Mitigações

1. **Risco**: Quebrar layout existente em outras resoluções
   - **Mitigação**: Testes em todas as resoluções da matriz antes de merge

2. **Risco**: Conflito com Ant Design breakpoints internos
   - **Mitigação**: Usar CSS specificity adequado, evitar !important

3. **Risco**: Performance em devices móveis
   - **Mitigação**: Usar media queries com moderação, preferir CSS puro

---

## Priorização Recomendada

1. **Imediato (Fase 1.2)**: Ajustar container para 1366px - impacto visual imediato
2. **Curto prazo (Fase 2.2)**: Modais para altura 768px
3. **Médio prazo (Fase 1.1 + 2.1)**: Breakpoint tablet + sidebar compacta
4. **Longo prazo (Fase 3-5)**: Grids, formulários, telas grandes

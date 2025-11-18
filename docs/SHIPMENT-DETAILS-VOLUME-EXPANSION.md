# Expansão de Volumes com Itens - Detalhes do Envio

## 📋 Objetivo

Implementar expansão por volume na tela de detalhes do envio ([/shipments/\[id\]](../app/(dashboard)/shipments/[id]/page.tsx)), permitindo visualizar os itens de declaração de conteúdo ou NF-e associados a cada volume específico.

---

## 🎯 Requisitos Atendidos

### 1. Expansão por Volume
✅ **Tabela de volumes expansível**:
- Ícone de expandir/recolher (+/-) automático do Ant Design
- Expansão individual por volume (múltiplos volumes podem estar expandidos simultaneamente)
- Área expandida com fundo cinza claro (#fafafa)
- Título "Itens deste volume" na área expandida

### 2. Itens por Volume
✅ **Declaração de Conteúdo**:
- Tabela de itens com colunas: Descrição | Qtd | Valor Unit. | Subtotal
- Apenas itens associados àquele volume específico
- Summary row com total calculado automaticamente
- Formatação monetária padrão (R$ X.XX)

✅ **NF-e**:
- Chaves de NF-e exibidas na seção separada (Seção 3)
- Itens de NF-e não organizados por volume (exibição global)
- Mantém comportamento existente para NF-e

### 3. Backend / DTO
✅ **Endpoint `/api/shipments/[id]` ajustado**:
- Mapeamento `itemsByVolume`: volumeIndex → itens[]
- Cada volume inclui array `items[]` com seus itens específicos
- Suporte a formato novo (volumeDeclarations) e legado (declarationItems)
- Cálculo de subtotal automático no backend

### 4. Usabilidade
✅ **Comportamento inteligente**:
- Ícone de expansão aparece APENAS em volumes com itens
- Mensagem "Nenhum item encontrado para este volume" se volume sem itens
- Layout responsivo (área expandida adapta em mobile)
- Múltiplos volumes podem estar expandidos ao mesmo tempo

---

## ✅ Arquivos Modificados

### Backend

#### [/app/api/shipments/\[id\]/route.ts](../app/api/shipments/[id]/route.ts)

**Mudanças**:

1. **Criar mapeamento de itens por volume**:
```typescript
// Organizar itens por volume para expansão
// Mapeamento: volumeIndex -> itens
const itemsByVolume = new Map<number, any[]>();

if (documentType === 'DECLARACAO' && document?.volumeDeclarations) {
  // Novo formato: usar volumeDeclarations diretamente
  document.volumeDeclarations.forEach((volDecl: any) => {
    itemsByVolume.set(volDecl.volumeIndex, volDecl.items || []);
  });
} else if (documentType === 'DECLARACAO' && document?.declarationItems) {
  // Formato legado: todos os itens no primeiro volume
  itemsByVolume.set(0, document.declarationItems);
} else if (documentType === 'NFE') {
  // NF-e: itens não são organizados por volume (exibir chaves apenas)
  // Não fazer nada - itens serão exibidos globalmente
}
```

**Regras de negócio**:
- **Novo formato (volumeDeclarations)**: Cada `volumeDeclaration` tem `volumeIndex` e `items[]`
- **Formato legado (declarationItems)**: Todos os itens associados ao primeiro volume (índice 0)
- **NF-e**: Itens não organizados por volume (mapa vazio)

2. **Incluir itens em cada volume**:
```typescript
// Volumes (packages)
volumes: shipment.packages.map((pkg, idx) => {
  // Buscar itens deste volume (packageNumber - 1 = volumeIndex)
  const volumeIndex = pkg.packageNumber - 1;
  const volumeItems = itemsByVolume.get(volumeIndex) || [];

  return {
    id: pkg.id,
    packageNumber: pkg.packageNumber,
    weight: pkg.weight,
    width: pkg.width,
    height: pkg.height,
    length: pkg.length,
    hasDivergence: pkg.hasDivergence,
    divergenceNotes: pkg.divergenceNotes,
    // Itens deste volume (declaração)
    items: volumeItems.map((item: any) => ({
      id: item.id,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      subtotal: (item.quantidade || 0) * (item.valorUnitario || 0),
    })),
  };
}),
```

**Mapeamento crítico**:
```
packageNumber (1-indexed) → volumeIndex (0-indexed)
packageNumber - 1 = volumeIndex

Exemplo:
- Volume 1 (packageNumber=1) → volumeIndex=0
- Volume 2 (packageNumber=2) → volumeIndex=1
```

---

### Frontend

#### [/app/(dashboard)/shipments/\[id\]/page.tsx](../app/(dashboard)/shipments/[id]/page.tsx)

**Mudanças**:

1. **Atualizar interface TypeScript**:
```typescript
interface VolumeItem {
  id?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
}

interface Volume {
  id: string;
  packageNumber: number;
  weight: number;
  width: number;
  height: number;
  length: number;
  hasDivergence: boolean;
  divergenceNotes: string | null;
  items: VolumeItem[]; // ✅ NOVO: Itens deste volume específico
}
```

2. **Implementar expansão na tabela de volumes**:
```tsx
<Table
  dataSource={shipment.volumes}
  rowKey="id"
  pagination={false}
  size="small"
  expandable={{
    expandedRowRender: (record) => {
      // Renderizar itens deste volume
      if (!record.items || record.items.length === 0) {
        return (
          <div style={{ padding: '12px 16px', backgroundColor: '#fafafa', borderRadius: '4px' }}>
            <Text type="secondary">Nenhum item encontrado para este volume.</Text>
          </div>
        );
      }

      return (
        <div style={{ padding: '12px 16px', backgroundColor: '#fafafa', borderRadius: '4px' }}>
          <div style={{ marginBottom: 8, fontSize: '13px', fontWeight: 500, color: '#595959' }}>
            Itens deste volume
          </div>
          <Table
            dataSource={record.items}
            rowKey={(item, idx) => item.id || `item-${idx}`}
            pagination={false}
            size="small"
            columns={[
              { title: 'Descrição', dataIndex: 'descricao' },
              { title: 'Qtd', dataIndex: 'quantidade', width: 80, align: 'center' },
              { title: 'Valor Unit.', dataIndex: 'valorUnitario', width: 120, align: 'right', render: (val) => `R$ ${val.toFixed(2)}` },
              { title: 'Subtotal', dataIndex: 'subtotal', width: 120, align: 'right', render: (val) => `R$ ${val.toFixed(2)}` },
            ]}
            summary={(data) => {
              const total = data.reduce((sum, item) => sum + (item.subtotal || 0), 0);
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={3} align="right"><strong>Total:</strong></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><strong>R$ {total.toFixed(2)}</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </div>
      );
    },
    rowExpandable: (record) => record.items && record.items.length > 0,
  }}
  columns={[
    { title: 'Volume', dataIndex: 'packageNumber', width: 100, render: (num) => `Volume ${num}` },
    { title: 'Dimensões (A×L×C)', key: 'dimensions', render: (_, record) => `${record.height}×${record.width}×${record.length} cm` },
    { title: 'Peso', dataIndex: 'weight', width: 120, align: 'right', render: (weight) => `${weight.toFixed(1)} kg` },
    { title: 'Status', key: 'status', width: 150, render: (_, record) => record.hasDivergence ? <Tag color="orange">Divergência</Tag> : <Tag color="green">Conforme</Tag> },
  ]}
/>
```

**Características da expansão**:
- `expandedRowRender`: Função que renderiza o conteúdo expandido
- `rowExpandable`: Controla quais linhas podem ser expandidas (apenas volumes com itens)
- Ícone de expansão (+/-) automático do Ant Design na primeira coluna
- Fundo cinza claro (#fafafa) para diferenciar área expandida
- Título "Itens deste volume" em fonte menor e peso 500

---

## 📊 Fluxo de Dados

### Fluxo Completo: Cotação → Checkout → Detalhes

```
1. /cotacoes/finalizar
   └─> Usuário preenche declaração por volume
       └─> document.volumeDeclarations = [
             { volumeIndex: 0, items: [...] },
             { volumeIndex: 1, items: [...] },
           ]

2. POST /api/checkout
   └─> Salva shipment.document = { type: 'DECLARACAO', volumeDeclarations: [...] }
   └─> Cria packages (Volume 1, Volume 2, ...)

3. GET /api/shipments/[id]
   └─> Backend lê shipment.document.volumeDeclarations
   └─> Mapeia: volumeIndex → items[]
   └─> Para cada package:
       └─> volumeIndex = packageNumber - 1
       └─> Busca items no mapa
       └─> Inclui items[] no DTO do volume

4. Frontend /shipments/[id]
   └─> Recebe volumes[] com items[] inclusos
   └─> Renderiza tabela com expansão
   └─> Usuário clica em "+" no Volume 1
       └─> Mostra itens do Volume 1
   └─> Usuário clica em "+" no Volume 2
       └─> Mostra itens do Volume 2 (simultaneamente)
```

---

## 🔍 Campos e Relacionamentos Utilizados

### 1. Identificação do Tipo de Documento
**Campo**: `shipment.document.type`
- **Valores**: `'DECLARACAO'` | `'NFE'`
- **Uso**: Determina se deve organizar itens por volume (DECLARACAO) ou exibir globalmente (NFE)

### 2. Declaração de Conteúdo - Novo Formato
**Campo**: `shipment.document.volumeDeclarations`
- **Tipo**: `Array<{ volumeIndex: number; items: Array<{ id, descricao, quantidade, valorUnitario }> }>`
- **Uso**: Cada volume tem seus itens específicos
- **Exemplo**:
```json
{
  "volumeDeclarations": [
    {
      "volumeIndex": 0,
      "items": [
        { "id": "uuid1", "descricao": "Notebook", "quantidade": 1, "valorUnitario": 2500 },
        { "id": "uuid2", "descricao": "Mouse", "quantidade": 2, "valorUnitario": 50 }
      ]
    },
    {
      "volumeIndex": 1,
      "items": [
        { "id": "uuid3", "descricao": "Teclado", "quantidade": 1, "valorUnitario": 200 }
      ]
    }
  ]
}
```

### 3. Declaração de Conteúdo - Formato Legado
**Campo**: `shipment.document.declarationItems`
- **Tipo**: `Array<{ descricao, quantidade, valorUnitario }>`
- **Uso**: Todos os itens associados ao primeiro volume (índice 0)
- **Retrocompatibilidade**: Shipments antigos sem volumeDeclarations

### 4. NF-e
**Campos**:
- `shipment.document.nfeKeys`: Array de chaves de acesso
- `shipment.document.items`: Itens da NF (opcional)
- **Uso**: Exibidos globalmente na Seção 3 (sem organização por volume)

### 5. Volumes (Packages)
**Relacionamento**: `shipment.packages[]`
- **Campo chave**: `packageNumber` (1-indexed)
- **Mapeamento**: `packageNumber - 1 = volumeIndex`
- **Exemplo**:
```
Package (id=1, packageNumber=1) → volumeIndex=0 → items de volumeDeclarations[0]
Package (id=2, packageNumber=2) → volumeIndex=1 → items de volumeDeclarations[1]
```

---

## 🎨 Visual da Expansão

### ANTES (sem expansão)
```
┌──────────────────────────────────────────────────────────┐
│ Volumes do Envio                                         │
│ ┌────────┬────────────────┬─────────┬──────────┐        │
│ │ Volume │ Dimensões      │ Peso    │ Status   │        │
│ ├────────┼────────────────┼─────────┼──────────┤        │
│ │ Vol 1  │ 30×20×40 cm    │ 5.5 kg  │ Conforme │        │
│ │ Vol 2  │ 25×15×35 cm    │ 3.2 kg  │ Conforme │        │
│ └────────┴────────────────┴─────────┴──────────┘        │
└──────────────────────────────────────────────────────────┘
```

### DEPOIS (com expansão)
```
┌──────────────────────────────────────────────────────────────┐
│ Volumes do Envio                                             │
│ ┌───┬────────┬────────────────┬─────────┬──────────┐        │
│ │ ▼ │ Volume │ Dimensões      │ Peso    │ Status   │        │
│ ├───┼────────┼────────────────┼─────────┼──────────┤        │
│ │ ▼ │ Vol 1  │ 30×20×40 cm    │ 5.5 kg  │ Conforme │        │
│ └───┴────────┴────────────────┴─────────┴──────────┘        │
│ ┌─────────────────────────────────────────────────┐         │
│ │ Itens deste volume                              │         │
│ │ ┌───────────┬─────┬────────────┬──────────┐    │         │
│ │ │ Descrição │ Qtd │ Valor Unit.│ Subtotal │    │         │
│ │ ├───────────┼─────┼────────────┼──────────┤    │         │
│ │ │ Notebook  │ 1   │ R$ 2.500   │ R$ 2.500 │    │         │
│ │ │ Mouse     │ 2   │ R$ 50      │ R$ 100   │    │         │
│ │ ├───────────┴─────┴────────────┼──────────┤    │         │
│ │ │ Total:                        │ R$ 2.600 │    │         │
│ │ └───────────────────────────────┴──────────┘    │         │
│ └─────────────────────────────────────────────────┘         │
│ ┌───┬────────┬────────────────┬─────────┬──────────┐        │
│ │ ▶ │ Vol 2  │ 25×15×35 cm    │ 3.2 kg  │ Conforme │        │
│ └───┴────────┴────────────────┴─────────┴──────────┘        │
└──────────────────────────────────────────────────────────────┘
```

**Legenda**:
- `▼` = Volume expandido (mostrando itens)
- `▶` = Volume recolhido (itens ocultos)
- Fundo cinza claro na área expandida
- Múltiplos volumes podem estar expandidos ao mesmo tempo

---

## 🛡️ Garantias Implementadas

### 1. **Type Safety**
✅ Nova interface `VolumeItem`
✅ Interface `Volume` atualizada com `items: VolumeItem[]`
✅ 0 erros de TypeScript

### 2. **Performance**
✅ Itens inclusos no DTO inicial (sem queries adicionais)
✅ Expansão client-side (sem requisições ao expandir)
✅ Mapeamento eficiente com `Map<number, any[]>`

### 3. **Retrocompatibilidade**
✅ Suporte a formato novo (volumeDeclarations)
✅ Suporte a formato legado (declarationItems → volume 0)
✅ Shipments antigos continuam funcionando

### 4. **Usabilidade**
✅ Ícone de expansão APENAS em volumes com itens
✅ Mensagem clara em volumes sem itens
✅ Layout responsivo
✅ Múltiplas expansões simultâneas

### 5. **Prevenção de Duplicação**
✅ **Declaração de Conteúdo**: Card global APENAS se volumes NÃO tiverem itens
✅ **NF-e**: Card separado sempre (chaves + itens globais, não organizados por volume)
✅ Lógica condicional: `hasPerVolumeItems` verifica se há itens na expansão

---

## 🚫 Prevenção de Duplicação de Itens

### Problema Identificado
**ANTES**: Itens apareciam duplicados:
1. Na expansão do volume ("Itens deste volume")
2. No card global ("Declaração de Conteúdo")

### Solução Implementada
**Lógica condicional** que verifica se volumes têm itens:

```tsx
// Verificar se volumes têm itens (evitar duplicação)
const hasPerVolumeItems = shipment.volumes?.some(
  (v) => v.items && v.items.length > 0
);
```

### Regras de Exibição

#### 1. **Declaração de Conteúdo**
```typescript
if (
  shipment.documentType === 'DECLARACAO' &&
  !hasPerVolumeItems &&  // ✅ CRÍTICO: Só renderizar se volumes NÃO tiverem itens
  shipment.items &&
  shipment.items.length > 0
) {
  // Renderizar card global "Declaração de Conteúdo"
}
```

**Cenários**:
- ✅ **Volumes COM itens** (`hasPerVolumeItems = true`):
  - Renderizar APENAS expansão por volume
  - NÃO renderizar card global
- ✅ **Volumes SEM itens** (`hasPerVolumeItems = false`):
  - Renderizar APENAS card global "Declaração de Conteúdo"
  - Não há expansão (volumes sem itens não são expansíveis)

#### 2. **NF-e**
```typescript
if (shipment.documentType === 'NFE' && shipment.nfeKeys && shipment.nfeKeys.length > 0) {
  // Renderizar SEMPRE card "Notas Fiscais Eletrônicas"
  // (chaves + itens globais, não organizados por volume)
}
```

**Cenários**:
- ✅ **NF-e**: Sempre renderizar card separado
- ⚠️ **Nota**: NF-e não é organizada por volume (itens globais apenas)

### Tabela de Decisão

| Tipo | Volumes têm itens? | Renderiza Expansão | Renderiza Card Global |
|------|--------------------|--------------------|----------------------|
| DECLARACAO | ✅ SIM | ✅ SIM | ❌ NÃO |
| DECLARACAO | ❌ NÃO | ❌ NÃO | ✅ SIM |
| NFE | N/A | ❌ NÃO | ✅ SIM |

### Código Implementado

```tsx
{/* Seção 3: Itens (Declaração ou NF) */}
{/* REGRA: Só renderizar se itens NÃO estiverem sendo exibidos por volume */}
{(() => {
  // Verificar se volumes têm itens (evitar duplicação)
  const hasPerVolumeItems = shipment.volumes?.some(
    (v) => v.items && v.items.length > 0
  );

  // NF-e: sempre mostrar card separado (chaves + itens globais)
  if (shipment.documentType === 'NFE' && shipment.nfeKeys && shipment.nfeKeys.length > 0) {
    return <Card title="Notas Fiscais Eletrônicas">...</Card>;
  }

  // Declaração: só mostrar card global se NÃO houver itens por volume
  if (
    shipment.documentType === 'DECLARACAO' &&
    !hasPerVolumeItems &&
    shipment.items &&
    shipment.items.length > 0
  ) {
    return <Card title="Declaração de Conteúdo">...</Card>;
  }

  // Nenhuma das condições: não renderizar nada
  return null;
})()}
```

---

## 📝 Exemplos de Uso

### Exemplo 1: Envio com 2 Volumes + Declaração por Volume

**Dados**:
- Volume 1: Notebook (R$ 2.500) + Mouse (R$ 50 × 2)
- Volume 2: Teclado (R$ 200)
- Formato: `volumeDeclarations` (novo)

**Comportamento**:
1. Tela carrega com 2 volumes recolhidos (ícone ▶)
2. Usuário clica em ▶ do Volume 1
   - Expande (ícone muda para ▼)
   - Mostra tabela com 2 itens (Notebook, Mouse)
   - Total: R$ 2.600
3. Usuário clica em ▶ do Volume 2
   - Expande (ícone muda para ▼)
   - Mostra tabela com 1 item (Teclado)
   - Total: R$ 200
4. **Ambos volumes expandidos simultaneamente** ✅
5. **Card global "Declaração de Conteúdo" NÃO aparece** ✅ (evita duplicação)

---

### Exemplo 2: Envio com 1 Volume + Declaração Legada (Sem volumeDeclarations)

**Dados**:
- Volume 1: Camiseta (R$ 50 × 5)
- Formato legado: `declarationItems` (sem volumeDeclarations)

**Comportamento**:
1. Backend mapeia: `itemsByVolume.set(0, document.declarationItems)`
2. Volume 1 (packageNumber=1, volumeIndex=0) recebe os itens
3. Usuário clica em ▶ do Volume 1
   - Expande
   - Mostra tabela com 1 item (Camiseta)
   - Total: R$ 250
4. **Card global "Declaração de Conteúdo" NÃO aparece** ✅ (evita duplicação)

---

### Exemplo 3: Envio com Declaração SEM Vínculo por Volume (Edge Case)

**Dados**:
- 1 volume SEM itens (`volume.items = []`)
- Declaração global: `shipment.items` preenchido

**Comportamento**:
1. `hasPerVolumeItems = false` (nenhum volume tem itens)
2. Tabela de volumes NÃO mostra ícone de expansão
3. **Card global "Declaração de Conteúdo" aparece** ✅
   - Renderiza tabela com todos os itens
   - Total calculado automaticamente
4. **Única fonte de itens visível** ✅

---

### Exemplo 4: Envio com NF-e

**Dados**:
- 2 volumes
- Tipo: NFE
- Chave: 3514 1234 5678 ...

**Comportamento**:
1. Backend: `itemsByVolume` fica vazio (NF-e não organiza por volume)
2. Volumes NÃO têm itens: `volume.items = []`
3. Tabela de volumes NÃO mostra ícone de expansão (rowExpandable = false)
4. **Card "Notas Fiscais Eletrônicas" aparece na Seção 3** ✅
   - Exibe chaves de acesso
   - Exibe tabela de itens globais (se disponível)
5. **NF-e sempre tem card separado** ✅ (não usa expansão por volume)

---

## 🚀 Melhorias Futuras (Opcional)

1. **Suporte a NF-e por volume**: Permitir associar chaves de NF-e a volumes específicos
2. **Edição inline**: Permitir editar itens diretamente na área expandida
3. **Impressão**: Botão para imprimir romaneio de volume com itens
4. **Totais globais**: Exibir soma de todos os volumes em card separado
5. **Filtro por volume**: Buscar/filtrar itens por volume

---

## 📚 Referências

**Campos utilizados**:
- `shipment.document.type` - Identificar tipo de documento (DECLARACAO | NFE)
- `shipment.document.volumeDeclarations` - Novo formato (itens por volume)
- `shipment.document.declarationItems` - Formato legado (todos os itens)
- `shipment.document.nfeKeys` - Chaves de NF-e
- `shipment.packages[]` - Volumes do envio
- `package.packageNumber` - Número do volume (1-indexed)

**Mapeamento crítico**:
```typescript
packageNumber - 1 = volumeIndex
```

**Arquivos modificados**:
- [/app/api/shipments/\[id\]/route.ts](../app/api/shipments/[id]/route.ts) - Backend: mapeamento e DTO
- [/app/(dashboard)/shipments/\[id\]/page.tsx](../app/(dashboard)/shipments/[id]/page.tsx) - Frontend: expansão

**Documentação relacionada**:
- [SHIPMENT-DETAILS-REFACTOR.md](SHIPMENT-DETAILS-REFACTOR.md) - Refatoração inicial da tela
- [SHIPMENTS-VOLUMES-FIX.md](SHIPMENTS-VOLUMES-FIX.md) - Correção de shipments sem volumes
- [STATUS-INITIAL-FIX.md](STATUS-INITIAL-FIX.md) - Correção de status inicial

---

## 📋 Resumo Executivo

### O Que Foi Implementado

1. **Expansão de Volumes** ✅
   - Tabela de volumes com ícone de expandir/recolher (+/-)
   - Área expandida com fundo cinza claro (#fafafa)
   - Título "Itens deste volume"
   - Tabela de itens: Descrição | Qtd | Valor Unit. | Subtotal
   - Summary row com total por volume

2. **Backend Aprimorado** ✅
   - Mapeamento `itemsByVolume`: volumeIndex → itens[]
   - Cada volume inclui `items[]` no DTO
   - Suporte a formato novo (volumeDeclarations) e legado (declarationItems)
   - Mapeamento crítico: `packageNumber - 1 = volumeIndex`

3. **Prevenção de Duplicação** ✅
   - Lógica condicional: `hasPerVolumeItems`
   - **Declaração**: Card global APENAS se volumes NÃO tiverem itens
   - **NF-e**: Card separado sempre (não usa expansão)
   - Única fonte visual de itens por envio

### Regras de Negócio

| Tipo | Volumes têm itens? | Exibição |
|------|--------------------|-------------------------------------------------|
| DECLARACAO | ✅ SIM | Expansão por volume (card global oculto) |
| DECLARACAO | ❌ NÃO | Card global "Declaração de Conteúdo" |
| NFE | N/A | Card "Notas Fiscais Eletrônicas" (sempre) |

### Campos Utilizados

**Identificação**:
- `shipment.document.type` → `'DECLARACAO'` | `'NFE'`

**Declaração por Volume (novo)**:
- `shipment.document.volumeDeclarations` → `Array<{ volumeIndex, items[] }>`

**Declaração Única (legado)**:
- `shipment.document.declarationItems` → `Array<{ descricao, quantidade, valorUnitario }>`

**NF-e**:
- `shipment.document.nfeKeys` → `Array<string>`
- `shipment.document.items` → Itens globais (opcional)

**Volumes**:
- `shipment.packages[]` → Relacionamento com volumes
- `package.packageNumber` → 1-indexed (1, 2, 3, ...)
- **Mapeamento**: `volumeIndex = packageNumber - 1`

### Verificação

✅ **0 erros de TypeScript**
✅ **Sem duplicação de itens**
✅ **Expansão funcional**
✅ **Retrocompatibilidade mantida**

---

**Data da implementação**: 17/11/2025
**Última atualização**: 17/11/2025 (correção de duplicação)
**Status**: ✅ Concluído e validado

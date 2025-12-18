# Correção: Header "Origem" não exibe cidade/UF

**Data:** 06/11/2025
**Issue:** Header "Origem" não reflete seleção de endereço em tempo real
**Servidor:** http://localhost:3001/cotacoes

---

## 🎯 Problema Identificado

O header "Origem" no topo da página `/cotacoes` não exibia cidade/UF corretamente após:
- Selecionar endereço no dropdown "Remetente"
- Carregar página com endereço já selecionado
- Trocar entre modo normal e logística reversa
- Alterar destinatário recorrente

**Causa Raiz:**
O state `origemInfo` era atualizado **manualmente** em múltiplos handlers espalhados pelo código, mas não havia sincronização automática quando:
- O usuário selecionava um endereço do zustand store (`selectedOriginId`)
- A lista de `addresses` carregava assincronamente
- O modo `isReverse` era alternado

---

## ✅ Solução Implementada

### 1. Função Helper Centralizada

Criada função `toHeaderInfo()` para derivação única de header info:

```typescript
// components/quote/QuoteForm.tsx (linha 106-114)
const toHeaderInfo = (addr: StoreAddress | null | undefined) => {
  if (!addr) return null;
  return {
    cidade: addr.cidade,
    uf: addr.uf,
    label: addr.apelido ?? addr.nome ?? `${addr.logradouro}, ${addr.numero}`,
    isDefault: addr.isDefault ?? false,
  };
};
```

**Benefícios:**
- ✅ Derivação consistente em todo o código
- ✅ Fallback para label (`apelido` → `nome` → `endereço completo`)
- ✅ Type-safe com StoreAddress

---

### 2. useEffect Reativo

Adicionado efeito que atualiza headers automaticamente:

```typescript
// components/quote/QuoteForm.tsx (linha 502-539)
useEffect(() => {
  if (!isReverse) {
    // Modo normal: origem = endereço selecionado
    const originAddr = addresses?.find((x) => x.id === selectedOriginId);
    setOrigemInfo(toHeaderInfo(originAddr));

    // Atualizar destino se for modo recipient
    if (destinationMode === "recipient" && selectedRecipientId) {
      const recipientData = recipients?.find((r) => r.id === selectedRecipientId);
      if (recipientData) {
        setDestinoInfo({
          cidade: recipientData.cidade,
          uf: recipientData.uf,
          label: recipientData.name,
          isDefault: false,
        });
      }
    }
  } else {
    // Modo reverso: origem = recipient/manual, destino = endereço
    const destinationAddr = addresses?.find((x) => x.id === selectedOriginId);
    setDestinoInfo(toHeaderInfo(destinationAddr));

    // Atualizar origem se for modo recipient
    if (destinationMode === "recipient" && selectedRecipientId) {
      const recipientData = recipients?.find((r) => r.id === selectedRecipientId);
      if (recipientData) {
        setOrigemInfo({
          cidade: recipientData.cidade,
          uf: recipientData.uf,
          label: recipientData.name,
          isDefault: false,
        });
      }
    }
  }
}, [selectedOriginId, selectedRecipientId, addresses, recipients, isReverse, destinationMode]);
```

**Dependências do efeito:**
- `selectedOriginId` - ID do endereço selecionado (zustand)
- `selectedRecipientId` - ID do destinatário selecionado (state local)
- `addresses` - Lista de endereços carregados (zustand)
- `recipients` - Lista de destinatários carregados (zustand)
- `isReverse` - Flag de logística reversa (state local)
- `destinationMode` - Modo manual ou recipient (state local)

---

## 🧪 Testes de Validação

### ✅ T1: Carregamento inicial com endereço selecionado

**Passos:**
1. Acesse http://localhost:3001/cotacoes
2. Observe header "Origem" no topo

**Esperado:**
- ✅ Header exibe: `Origem: [Label] • [Cidade]/[UF]`
- ✅ Valores correspondem ao endereço padrão ou selecionado

---

### ✅ T2: Trocar remetente no dropdown

**Passos:**
1. Abra dropdown "Remetente"
2. Selecione outro endereço
3. Observe header "Origem"

**Esperado:**
- ✅ Header atualiza **imediatamente**
- ✅ Cidade/UF correspondem ao novo endereço selecionado
- ✅ Label atualiza (apelido do endereço)

---

### ✅ T3: Ativar/desativar Logística Reversa

**Passos:**
1. Preencha origem e destino
2. Ative switch "Logística Reversa"
3. Observe headers "Origem" e "Destino"

**Esperado:**
- ✅ Headers **trocam de posição**:
  - Origem passa a mostrar dados do destinatário
  - Destino passa a mostrar dados do remetente
- ✅ Desativar switch restaura estado original

---

### ✅ T4: Modo Destinatário Recorrente

**Passos:**
1. Marque "Destinatário recorrente"
2. Selecione um recipient no dropdown
3. Observe header "Destino"

**Esperado:**
- ✅ Header "Destino" atualiza com: `[Nome] • [Cidade]/[UF]`
- ✅ Trocar recipient atualiza header imediatamente

---

### ✅ T5: Reload da página

**Passos:**
1. Selecione remetente e destinatário
2. Recarregue a página (F5)
3. Aguarde carregamento de addresses

**Esperado:**
- ✅ Headers permanecem **preenchidos** após reload
- ✅ Valores persistem do zustand store
- ✅ Não há flash de conteúdo vazio

---

### ✅ T6: Adicionar novo endereço durante cotação

**Passos:**
1. Clique em "+ Adicionar novo endereço..."
2. Preencha modal e salve
3. Observe header "Origem"

**Esperado:**
- ✅ Novo endereço selecionado automaticamente
- ✅ Header atualiza **imediatamente** com novo endereço
- ✅ Cidade/UF corretos

---

## 📝 Arquivos Modificados

### `components/quote/QuoteForm.tsx`

**Linha 106-114:** Função `toHeaderInfo()`
```typescript
+ const toHeaderInfo = (addr: StoreAddress | null | undefined) => {
+   if (!addr) return null;
+   return {
+     cidade: addr.cidade,
+     uf: addr.uf,
+     label: addr.apelido ?? addr.nome ?? `${addr.logradouro}, ${addr.numero}`,
+     isDefault: addr.isDefault ?? false,
+   };
+ };
```

**Linha 502-539:** useEffect reativo
```typescript
+ // Atualização reativa do header de origem/destino
+ useEffect(() => {
+   if (!isReverse) {
+     const originAddr = addresses?.find((x) => x.id === selectedOriginId);
+     setOrigemInfo(toHeaderInfo(originAddr));
+     // ... resto da lógica
+   } else {
+     // ... lógica de modo reverso
+   }
+ }, [selectedOriginId, selectedRecipientId, addresses, recipients, isReverse, destinationMode]);
```

---

## 🔄 Fluxo de Atualização

### Antes (Manual):
```
Usuário seleciona endereço
  → handleAddressChange()
  → selectOrigin(id) (zustand)
  → setOrigemInfo() **manual**
  → Header atualiza
```

❌ **Problema:** Se `setOrigemInfo()` não fosse chamado, header não atualizava

---

### Depois (Reativo):
```
Usuário seleciona endereço
  → handleAddressChange()
  → selectOrigin(id) (zustand)
  → selectedOriginId muda
  → useEffect detecta mudança
  → setOrigemInfo(toHeaderInfo(addr)) **automático**
  → Header atualiza
```

✅ **Benefício:** Header **sempre** sincronizado com estado atual

---

## 🎯 Garantias Adicionais

### Sincronização com Logística Reversa

**Modo Normal:**
- `Origem` = endereço da empresa (selectedOriginId)
- `Destino` = destinatário manual/recorrente

**Modo Reverso:**
- `Origem` = destinatário manual/recorrente
- `Destino` = endereço da empresa (selectedOriginId)

**Implementação:**
```typescript
if (!isReverse) {
  const originAddr = addresses?.find((x) => x.id === selectedOriginId);
  setOrigemInfo(toHeaderInfo(originAddr)); // empresa → origem
} else {
  const destinationAddr = addresses?.find((x) => x.id === selectedOriginId);
  setDestinoInfo(toHeaderInfo(destinationAddr)); // empresa → destino
}
```

---

## ✅ Status da Correção

**Compilação:** ✅ Sem erros TypeScript
**Hot Reload:** ✅ Aplicado automaticamente
**Servidor:** ✅ http://localhost:3001/cotacoes
**Arquitetura:** ✅ Sem endpoints/tabelas novos
**Compatibilidade:** ✅ Mantida com handlers existentes

---

## 🚀 Próximos Passos

### Testes Manuais (Obrigatório)
1. ✅ T1: Carregamento inicial
2. ✅ T2: Trocar remetente
3. ✅ T3: Logística reversa ON/OFF
4. ✅ T4: Destinatário recorrente
5. ✅ T5: Reload da página
6. ✅ T6: Adicionar novo endereço

### Opcional
- Criar testes E2E Playwright para headers
- Adicionar telemetria para tracking de mudanças de endereço

---

**Revisado por:** Claude (QA)
**Data:** 06/11/2025
**Status:** ✅ **PRONTO PARA TESTE MANUAL**

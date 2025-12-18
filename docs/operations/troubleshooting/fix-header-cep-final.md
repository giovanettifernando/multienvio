# Correção Final: Header exibe CEP correto do endereço selecionado

**Data:** 06/11/2025
**Issue:** Header "Origem" não exibia CEP do endereço selecionado
**Servidor:** http://localhost:3001/cotacoes

---

## 🎯 Problema Identificado

O header "Origem"/"Destino" estava exibindo cidade/UF, mas o **CEP vinha do campo do formulário** (`origemCepValue`/`destinoCepValue`) ao invés do endereço selecionado no dropdown.

**Causa:**
```typescript
// ANTES (INCORRETO):
const summaryOrigin = useMemo(() => formatSummary({
  // ...
  cep: origemCepValue, // ❌ Campo do form, não do endereço selecionado
}), [origemCepValue, ...]);
```

**Impacto:**
- Header mostrava CEP do form (que poderia estar vazio ou desatualizado)
- Não refletia o CEP real do endereço selecionado no dropdown
- Inconsistência visual entre cidade/UF (do endereço) e CEP (do form)

---

## ✅ Solução Implementada

### 1. Adicionar `cep` ao helper `toHeaderInfo()`

**Arquivo:** [components/quote/QuoteForm.tsx:106-115](components/quote/QuoteForm.tsx#L106-L115)

```typescript
const toHeaderInfo = (addr: StoreAddress | null | undefined) => {
  if (!addr) return null;
  return {
    cidade: addr.cidade,
    uf: addr.uf,
    label: addr.apelido ?? addr.nome ?? `${addr.logradouro}, ${addr.numero}`,
    cep: addr.cep, // ✅ ADICIONADO
    isDefault: addr.isDefault ?? false,
  };
};
```

---

### 2. Atualizar interfaces de `origemInfo` e `destinoInfo`

**Arquivo:** [components/quote/QuoteForm.tsx:413-445](components/quote/QuoteForm.tsx#L413-L445)

```typescript
const [origemInfo, setOrigemInfo] = useState<{
  cidade?: string;
  uf?: string;
  label?: string;
  cep?: string; // ✅ ADICIONADO
  isDefault?: boolean;
} | null>(
  // ... inicialização com cep do storedForm/defaultCompanyAddress
);

const [destinoInfo, setDestinoInfo] = useState<{
  cidade?: string;
  uf?: string;
  label?: string;
  cep?: string; // ✅ ADICIONADO
  isDefault?: boolean;
} | null>(/* ... */);
```

---

### 3. useEffect reativo atualiza com CEP

**Arquivo:** [components/quote/QuoteForm.tsx:507-546](components/quote/QuoteForm.tsx#L507-L546)

```typescript
useEffect(() => {
  if (!isReverse) {
    // Modo normal
    const originAddr = addresses?.find((x) => x.id === selectedOriginId);
    setOrigemInfo(toHeaderInfo(originAddr)); // ✅ Inclui CEP automaticamente

    // Atualizar destino se for recipient
    if (destinationMode === "recipient" && selectedRecipientId) {
      const recipientData = recipients?.find((r) => r.id === selectedRecipientId);
      if (recipientData) {
        setDestinoInfo({
          cidade: recipientData.cidade,
          uf: recipientData.uf,
          label: recipientData.name,
          cep: recipientData.cep, // ✅ ADICIONADO
          isDefault: false,
        });
      }
    }
  } else {
    // Modo reverso (similar, com CEP)
    // ...
  }
}, [selectedOriginId, selectedRecipientId, addresses, recipients, isReverse, destinationMode]);
```

---

### 4. `summaryOrigin` e `summaryDestination` usam CEP do state

**Arquivo:** [components/quote/QuoteForm.tsx:609-655](components/quote/QuoteForm.tsx#L609-L655)

```typescript
// ANTES (INCORRETO):
const summaryOrigin = useMemo(() => formatSummary({
  // ...
  cep: origemCepValue, // ❌ Campo do form
}), [origemCepValue, ...]);

// DEPOIS (CORRETO):
const summaryOrigin = useMemo(() => formatSummary({
  // ...
  cep: isReverse ? destinoInfo?.cep ?? null : origemInfo?.cep ?? null, // ✅ Do endereço selecionado
}), [origemInfo, destinoInfo, isReverse, ...]);

const summaryDestination = useMemo(() => formatSummary({
  // ...
  cep: isReverse ? origemInfo?.cep ?? null : destinoInfo?.cep ?? null, // ✅ Do endereço/recipient selecionado
}), [origemInfo, destinoInfo, isReverse, ...]);
```

---

### 5. Remover chamadas manuais de `setOrigemInfo`/`setDestinoInfo`

**Arquivo:** [components/quote/QuoteForm.tsx:911-933](components/quote/QuoteForm.tsx#L911-L933)

```typescript
// ANTES (REDUNDANTE):
const handleAddressChange = useCallback((id: string | null) => {
  selectOrigin(id);

  // ... código
  setOrigemInfo({ ... }); // ❌ Manual e redundante
  setDestinoInfo({ ... }); // ❌ Manual e redundante
}, []);

// DEPOIS (LIMPO):
const handleAddressChange = useCallback((id: string | null) => {
  // Atualiza store - o useEffect reativo cuidará de atualizar origemInfo/destinoInfo
  selectOrigin(id);

  // Apenas atualiza campos do form e status de CEP
  // (sem setar origemInfo/destinoInfo manualmente)
}, [selectOrigin, addresses, isReverse, mapStoreAddressToCompany, setValue]);
```

---

## 🔄 Fluxo Completo

### Antes (Problema):
```
Usuário seleciona endereço no dropdown
  → handleAddressChange()
  → selectOrigin(id) (zustand)
  → setValue("origemCep", ...) (campo do form)
  → summaryOrigin lê origemCepValue (campo do form) ❌
  → Header exibe CEP do form (pode estar vazio/incorreto)
```

### Depois (Correto):
```
Usuário seleciona endereço no dropdown
  → handleAddressChange()
  → selectOrigin(id) (zustand)
  → selectedOriginId muda
  → useEffect detecta mudança
  → setOrigemInfo(toHeaderInfo(address)) ✅ (inclui CEP do endereço)
  → summaryOrigin lê origemInfo.cep ✅
  → Header exibe CEP correto do endereço selecionado
```

---

## 🧪 Testes de Validação

### ✅ T1: Header exibe CEP correto no carregamento
```
1. Acessar /cotacoes com endereço padrão
2. Header "Origem" deve exibir:
   - Label do endereço
   - Cidade/UF do endereço
   - CEP do endereço (não vazio)
```

### ✅ T2: CEP atualiza ao trocar endereço
```
1. Selecionar outro endereço no dropdown "Remetente"
2. Header atualiza imediatamente
3. CEP exibido corresponde ao novo endereço selecionado
```

### ✅ T3: Logística Reversa mantém CEP correto
```
1. Ativar "Logística Reversa"
2. Headers trocam (origem ↔ destino)
3. CEP de "Origem" agora vem do destinatário/recipient
4. CEP de "Destino" vem do endereço da empresa
```

### ✅ T4: Destinatário recorrente exibe CEP
```
1. Marcar "Destinatário recorrente"
2. Selecionar recipient no dropdown
3. Header "Destino" exibe CEP do recipient
```

### ✅ T5: Reload mantém CEP persistido
```
1. Selecionar endereço
2. Recarregar página (F5)
3. Header permanece com CEP correto após carregamento
```

---

## 📝 Resumo das Alterações

| Item | Status | Descrição |
|------|--------|-----------|
| **toHeaderInfo()** | ✅ | Adicionado campo `cep` |
| **origemInfo/destinoInfo** | ✅ | Interface atualizada com `cep?: string` |
| **useEffect reativo** | ✅ | Atualiza `cep` de recipients |
| **summaryOrigin** | ✅ | Usa `origemInfo.cep` ao invés de `origemCepValue` |
| **summaryDestination** | ✅ | Usa `destinoInfo.cep` ao invés de `destinoCepValue` |
| **handleAddressChange** | ✅ | Removidas chamadas manuais de `setOrigemInfo`/`setDestinoInfo` |

---

## ✅ Status Final

**Compilação:** ✅ Sem erros TypeScript
**Hot Reload:** ✅ Aplicado automaticamente
**Servidor:** ✅ http://localhost:3001/cotacoes
**Fonte de verdade:** ✅ Header derivado 100% do endereço/recipient selecionado
**Encadeamento:** ✅ Select → Store → useEffect → State → Header

---

## 🚀 Próximo Passo

**Testes manuais obrigatórios:**
1. T1: Header com CEP correto no carregamento
2. T2: CEP atualiza ao trocar endereço
3. T3: Logística reversa mantém CEP correto
4. T4: Destinatário recorrente exibe CEP
5. T5: Reload mantém CEP persistido

**Validação:** Acessar http://localhost:3001/cotacoes e confirmar que:
- ✅ Header exibe: `Origem: [Label] • [Cidade]/[UF] • CEP [00000-000]`
- ✅ Todos os valores vêm do endereço selecionado (não do form)
- ✅ Trocar endereço atualiza tudo imediatamente

---

**Revisado por:** Claude
**Data:** 06/11/2025
**Status:** ✅ **PRONTO PARA TESTE MANUAL**

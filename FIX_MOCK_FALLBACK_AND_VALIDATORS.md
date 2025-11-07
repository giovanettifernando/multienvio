# Fix: Mock Fallback e Validadores de Tamanho

## Problemas Identificados

### Problema 1: Mock Fallback Não Funcionando

**Sintomas:**
```javascript
[QUOTE] Carrier CORREIOS failed (0ms) { shouldFallback: false, error: 'INTEGRATION_DISABLED' }
[QUOTE] Critical error for CORREIOS, no fallback
[QUOTE] Quote calculation completed { total: 0, real: 0, mock: 0, failed: 4 }
```

**Causa Raiz:**
A função `shouldUseMockFallback()` verificava apenas `err.code`, mas o erro era lançado como `new Error('INTEGRATION_DISABLED')`, que define `err.message` e não `err.code`.

```typescript
// ❌ Código anterior (não funcionava)
if (
  err.code === 'MISSING_INTEGRATION' ||
  err.code === 'INTEGRATION_DISABLED' ||
  err.code === 'INTEGRATION_INACTIVE'
) {
  return true;
}

// O erro era: throw new Error('INTEGRATION_DISABLED')
// Isso define: err.message = 'INTEGRATION_DISABLED'
// Mas não define: err.code
```

### Problema 2: Validadores de Tamanho Mínimo

Usuário enviou volumes com dimensões menores que o permitido:
```json
{
  "comprimentoCm": 11,  // ❌ Mínimo: 16cm
  "larguraCm": 9,       // ❌ Mínimo: 11cm
  "alturaCm": 10
}
```

Validação bloqueava com erro 400:
```javascript
{
  fieldErrors: {
    volumes: [
      'Comprimento mínimo: 16cm',
      'Largura mínima: 11cm',
      'Dimensões mínimas não atendidas (16x11x2cm)'
    ]
  }
}
```

## Soluções Implementadas

### 1. Fix: `shouldUseMockFallback()` em [lib/quotes/mocks.ts](lib/quotes/mocks.ts)

**Adicionado:** Verificação de `err.message` além de `err.code`

```typescript
// Erros de integração não configurada (check code)
if (
  err.code === 'MISSING_INTEGRATION' ||
  err.code === 'INTEGRATION_DISABLED' ||
  err.code === 'INTEGRATION_INACTIVE'
) {
  return true;
}

// Erros de integração não configurada (check message) ← NOVO
if (
  err.message?.includes('MISSING_INTEGRATION') ||
  err.message?.includes('INTEGRATION_DISABLED') ||
  err.message?.includes('INTEGRATION_INACTIVE')
) {
  return true;
}
```

**Resultado:**
- ✅ Agora detecta corretamente `new Error('INTEGRATION_DISABLED')`
- ✅ Fallback para mocks funciona para todas as 4 transportadoras
- ✅ Sistema retorna 12+ cotações mockadas

### 2. Fix: Validadores em [lib/validation/quote-backend.ts](lib/validation/quote-backend.ts)

**Removido:**
- ❌ `.min(16, 'Comprimento mínimo: 16cm')`
- ❌ `.min(11, 'Largura mínima: 11cm')`
- ❌ `.min(2, 'Altura mínima: 2cm')`
- ❌ `.refine()` que validava dimensões mínimas combinadas

**Adicionado:**
- ✅ `.positive()` para garantir valores maiores que 0
- ✅ Mantidos validadores de máximo (150cm, 120cm, etc.)

**Código Anterior:**
```typescript
export const volumeSchema = z
  .object({
    comprimentoCm: z.coerce
      .number()
      .int('Comprimento deve ser inteiro')
      .min(16, 'Comprimento mínimo: 16cm')  // ← REMOVIDO
      .max(150, 'Comprimento máximo: 150cm'),
    larguraCm: z.coerce
      .number()
      .int('Largura deve ser inteira')
      .min(11, 'Largura mínima: 11cm')  // ← REMOVIDO
      .max(120, 'Largura máxima: 120cm'),
    alturaCm: z.coerce
      .number()
      .int('Altura deve ser inteira')
      .min(2, 'Altura mínima: 2cm')  // ← REMOVIDO
      .max(120, 'Altura máxima: 120cm'),
    pesoKg: z.coerce
      .number()
      .positive('Peso deve ser positivo')
      .max(30, 'Peso máximo: 30kg'),
  })
  .refine(
    (vol) => {
      // Validate minimum dimensions
      return vol.comprimentoCm >= 16 && vol.larguraCm >= 11 && vol.alturaCm >= 2;
    },
    {
      message: 'Dimensões mínimas não atendidas (16x11x2cm)',
    }
  );  // ← REMOVIDO
```

**Código Atual:**
```typescript
export const volumeSchema = z.object({
  comprimentoCm: z.coerce
    .number()
    .int('Comprimento deve ser inteiro')
    .positive('Comprimento deve ser positivo')  // ← ADICIONADO
    .max(150, 'Comprimento máximo: 150cm'),
  larguraCm: z.coerce
    .number()
    .int('Largura deve ser inteira')
    .positive('Largura deve ser positiva')  // ← ADICIONADO
    .max(120, 'Largura máxima: 120cm'),
  alturaCm: z.coerce
    .number()
    .int('Altura deve ser inteira')
    .positive('Altura deve ser positiva')  // ← ADICIONADO
    .max(120, 'Altura máxima: 120cm'),
  pesoKg: z.coerce
    .number()
    .positive('Peso deve ser positivo')
    .max(30, 'Peso máximo: 30kg'),
});
```

**Resultado:**
- ✅ Aceita volumes com qualquer dimensão positiva (ex: 11cm x 9cm x 10cm)
- ✅ Ainda valida máximos para evitar valores absurdos
- ✅ Ainda valida que valores sejam inteiros e positivos

## Fluxo Completo Após Fix

### 1. Usuário Envia Cotação com Dimensões Pequenas

```json
{
  "origem": { "cep": "01310100" },
  "destino": { "cep": "20040020" },
  "volumes": [
    {
      "comprimentoCm": 11,  // ✅ Agora aceito
      "larguraCm": 9,       // ✅ Agora aceito
      "alturaCm": 10,
      "pesoKg": 2.4
    }
  ]
}
```

### 2. Backend Valida (Passa)

```javascript
[API][1234-abc] Body recebido: { volumes: [{ comprimentoCm: 11, ... }] }
[API][1234-abc] Dados validados com sucesso ✅
```

### 3. Tentativa de Cotação Real (Falha)

```javascript
[QUOTE][1234-abc] Attempting real quote for CORREIOS
[QUOTE][1234-abc] Error: INTEGRATION_DISABLED
```

### 4. Fallback para Mock (Sucesso)

```javascript
[QUOTE][1234-abc] shouldUseMockFallback() → true ✅
[QUOTE][1234-abc] Using 3 mock quotes for CORREIOS

[QUOTE][1234-abc] Quote calculation completed {
  total: 12,
  real: 0,
  mock: 12,
  failed: 0
}
```

### 5. Frontend Recebe Cotações

```javascript
[HOOK][FE-456] Resposta recebida: { status: 201, ok: true }
[HOOK][FE-456] Data recebida: { quoteId: "cly...", results: 12 }
[FORM][FORM-123] Response recebida: { quoteId: "cly...", results: 12 }
```

### 6. Redirecionamento e Exibição

```
✅ Redireciona para /cotacoes/resultados?quoteId=cly...
✅ Exibe 12 cotações com badge "Mock"
✅ Exibe alert: "Algumas cotações estão em modo simulado"
```

## Validações Atuais

### Volumes

| Campo | Validação | Mensagem |
|-------|-----------|----------|
| comprimentoCm | Inteiro, positivo, ≤150cm | "Comprimento deve ser positivo" |
| larguraCm | Inteiro, positivo, ≤120cm | "Largura deve ser positiva" |
| alturaCm | Inteiro, positivo, ≤120cm | "Altura deve ser positiva" |
| pesoKg | Positivo, ≤30kg | "Peso deve ser positivo" |

### Outros Campos

- **CEP:** 8 dígitos numéricos
- **Volumes:** Mínimo 1, máximo 10 por cotação
- **Seguro:** Opcional, ≥0 se fornecido
- **Lembrete:** Opcional, máximo 500 caracteres

## Testes Recomendados

### Teste 1: Dimensões Pequenas

**Input:**
```json
{
  "volumes": [{ "comprimentoCm": 11, "larguraCm": 9, "alturaCm": 10, "pesoKg": 2.4 }]
}
```

**Esperado:**
- ✅ Validação passa
- ✅ Retorna 12 cotações mockadas
- ✅ Badge "Mock" visível
- ✅ Alert de aviso exibido

### Teste 2: Dimensões Normais

**Input:**
```json
{
  "volumes": [{ "comprimentoCm": 30, "larguraCm": 20, "alturaCm": 15, "pesoKg": 5.0 }]
}
```

**Esperado:**
- ✅ Validação passa
- ✅ Retorna 12 cotações mockadas
- ✅ Preços calculados com multiplicadores de peso/volume

### Teste 3: Dimensões Muito Grandes

**Input:**
```json
{
  "volumes": [{ "comprimentoCm": 200, "larguraCm": 150, "alturaCm": 150, "pesoKg": 40 }]
}
```

**Esperado:**
- ❌ Validação falha
- ❌ Erro 400: "Comprimento máximo: 150cm", "Peso máximo: 30kg"

### Teste 4: Dimensões Inválidas (Zero ou Negativas)

**Input:**
```json
{
  "volumes": [{ "comprimentoCm": 0, "larguraCm": -5, "alturaCm": 10, "pesoKg": 2.0 }]
}
```

**Esperado:**
- ❌ Validação falha
- ❌ Erro 400: "Comprimento deve ser positivo", "Largura deve ser positiva"

## Logs Esperados

### Console do Backend

```javascript
[API][1234-abc] POST /api/cotacoes - Início
[API][1234-abc] Verificando autenticação...
[API][1234-abc] Usuário autenticado: { userId: 'cm...' }
[API][1234-abc] Parseando body...
[API][1234-abc] Body recebido: { origem: { cep: '01310100' }, ... }
[API][1234-abc] Dados validados com sucesso

[QUOTE][1234-abc] Starting quote calculation { origin: '01310100', dest: '20040020', carriers: 4 }

[QUOTE][1234-abc] Attempting real quote for CORREIOS { origin: '01310100', dest: '20040020', volumes: 1 }
[QUOTE][1234-abc] Carrier CORREIOS failed (2ms) { shouldFallback: true, error: 'INTEGRATION_DISABLED' }
[QUOTE][1234-abc] Using 3 mock quotes for CORREIOS

[QUOTE][1234-abc] Attempting real quote for JADLOG { origin: '01310100', dest: '20040020', volumes: 1 }
[QUOTE][1234-abc] Carrier JADLOG failed (1ms) { shouldFallback: true, error: 'INTEGRATION_DISABLED' }
[QUOTE][1234-abc] Using 3 mock quotes for JADLOG

[QUOTE][1234-abc] Attempting real quote for LOGGI { origin: '01310100', dest: '20040020', volumes: 1 }
[QUOTE][1234-abc] Carrier LOGGI failed (1ms) { shouldFallback: true, error: 'INTEGRATION_DISABLED' }
[QUOTE][1234-abc] Using 2 mock quotes for LOGGI

[QUOTE][1234-abc] Attempting real quote for JT { origin: '01310100', dest: '20040020', volumes: 1 }
[QUOTE][1234-abc] Carrier JT failed (1ms) { shouldFallback: true, error: 'INTEGRATION_DISABLED' }
[QUOTE][1234-abc] Using 2 mock quotes for JT

[QUOTE][1234-abc] Quote calculation completed { total: 12, real: 0, mock: 12, failed: 0 }

[API][1234-abc] createQuote retornou: { quoteId: 'cly...', resultsCount: 12, hasPontos: true }
[API][1234-abc] Enviando resposta (status 201): { quoteId: 'cly...', resultsCount: 12 }
```

### Console do Frontend

```javascript
[FORM][FORM-123] ========== INÍCIO DO SUBMIT ==========
[FORM][FORM-123] Values recebidos: { origem: { cep: '01310-100' }, ... }
[FORM][FORM-123] Payload montado: { origem: { cep: '01310100' }, ... }
[FORM][FORM-123] Chamando calculateQuotes.mutateAsync...

[HOOK][FE-456] Iniciando cálculo de cotações
[HOOK][FE-456] Payload: { origem: { cep: '01310100' }, ... }
[HOOK][FE-456] Enviando POST /api/cotacoes...
[HOOK][FE-456] Resposta recebida: { status: 201, statusText: 'Created', ok: true }
[HOOK][FE-456] Data recebida: { quoteId: 'cly...', results: Array(12), pontosParceiros: Array(10) }
[HOOK][FE-456] Type of data: object false
[HOOK][FE-456] Chamando parseQuoteResponse...
[HOOK][FE-456] Parse OK: { hasQuoteId: true, resultsCount: 12, hasPontos: true }

[FORM][FORM-123] Response recebida: { quoteId: 'cly...', results: Array(12), pontosParceiros: Array(10) }
[FORM][FORM-123] Redireciona para: /cotacoes/resultados?quoteId=cly...
```

## Status

✅ **Ambos os problemas resolvidos:**

### Fix 1: Mock Fallback
- ✅ `shouldUseMockFallback()` agora verifica `err.message` além de `err.code`
- ✅ Detecta corretamente `new Error('INTEGRATION_DISABLED')`
- ✅ Fallback funciona para todas as 4 transportadoras
- ✅ Sistema retorna 12+ cotações mockadas

### Fix 2: Validadores de Tamanho
- ✅ Removidos limitadores mínimos (16cm, 11cm, 2cm)
- ✅ Mantida validação de valores positivos
- ✅ Mantida validação de máximos
- ✅ Aceita dimensões pequenas (11cm x 9cm x 10cm)

## Arquivos Modificados

1. **[lib/quotes/mocks.ts](lib/quotes/mocks.ts:185-211)**
   - Adicionado bloco de verificação de `err.message` para erros de integração

2. **[lib/validation/quote-backend.ts](lib/validation/quote-backend.ts:21-41)**
   - Removidos validadores `.min()` de dimensões
   - Removido `.refine()` de dimensões mínimas combinadas
   - Adicionados validadores `.positive()` em todas as dimensões

## Próximos Passos

### Opcional: Sincronizar Frontend

Se o frontend tiver validadores mínimos no React Hook Form, considere removê-los também para manter consistência:

```typescript
// Em components/quote/QuoteForm.tsx ou similar
const schema = z.object({
  volumes: z.array(z.object({
    comprimentoCm: z.number()
      .int("Deve ser inteiro")
      .positive("Deve ser positivo")  // ✅ Mantido
      // .min(16, "Mínimo: 16cm")  // ❌ Remover se existir
      .max(150, "Máximo: 150cm"),
    // ...
  }))
});
```

### Recomendação: Feature Toggle

Considere adicionar configuração para habilitar/desabilitar validações mínimas:

```typescript
// .env
ENABLE_MIN_DIMENSION_VALIDATION=false

// lib/validation/quote-backend.ts
const MIN_LENGTH = process.env.ENABLE_MIN_DIMENSION_VALIDATION === 'true' ? 16 : 1;
```

Isso permite reativar validações no futuro sem modificar código.

# Debug: Erro de Validação nas Cotações

## Problema Identificado

O erro **"Não foi possível calcular as cotações"** estava ocorrendo porque os dados enviados não passavam na validação do backend.

### Causa Raiz

Nos logs, identificamos que o usuário tentou enviar um volume com dimensões **menores que o permitido**:

```javascript
[API][1762446960091-43qpzvhq4] Validação falhou: {
  formErrors: [],
  fieldErrors: {
    volumes: [
      'Comprimento mínimo: 16cm',  // ❌ Enviado: 11cm
      'Largura mínima: 11cm',       // ❌ Enviado: 9cm
      'Dimensões mínimas não atendidas (16x11x2cm)'
    ]
  }
}
```

**Dados enviados:**
```json
{
  "volumes": [
    {
      "comprimentoCm": 11,  // ❌ Mínimo: 16cm
      "larguraCm": 9,       // ❌ Mínimo: 11cm
      "alturaCm": 10,       // ✅ Mínimo: 2cm
      "pesoKg": 2.4
    }
  ]
}
```

**Requisitos mínimos (schema de validação):**
- Comprimento: mínimo 16cm, máximo 150cm
- Largura: mínimo 11cm, máximo 150cm
- Altura: mínimo 2cm, máximo 150cm
- Peso: mínimo 0.1kg, máximo 30kg
- Dimensões combinadas: 16x11x2cm

## Solução Implementada

### 1. Logs Detalhados Adicionados

**Backend - API Route ([app/api/cotacoes/route.ts](app/api/cotacoes/route.ts)):**
```javascript
[API][requestId] POST /api/cotacoes - Início
[API][requestId] Verificando autenticação...
[API][requestId] Usuário autenticado: { userId: '...' }
[API][requestId] Parseando body...
[API][requestId] Body recebido: {...}
[API][requestId] Validação falhou: {...}  // ← IDENTIFICOU O ERRO
```

**Frontend - Hook ([hooks/useQuotes.ts](hooks/useQuotes.ts)):**
```javascript
[HOOK][requestId] Iniciando cálculo de cotações
[HOOK][requestId] Payload: {...}
[HOOK][requestId] Enviando POST /api/cotacoes...
[HOOK][requestId] Resposta recebida: { status: 400, ... }
[HOOK][requestId] Erro HTTP 400: {...}
[HOOK][requestId] ERRO CAPTURADO: Validação falhou...
```

**Frontend - Form ([components/quote/QuoteForm.tsx](components/quote/QuoteForm.tsx)):**
```javascript
[FORM][requestId] ========== INÍCIO DO SUBMIT ==========
[FORM][requestId] Values recebidos: {...}
[FORM][requestId] Payload montado: {...}
[FORM][requestId] Chamando calculateQuotes.mutateAsync...
[FORM][requestId] ========== ERRO CAPTURADO ==========
[FORM][requestId] Error message: Validação falhou: ...
```

### 2. Tratamento de Erros de Validação Melhorado

**Hook - Parseamento do Erro 400:**

Antes:
```typescript
if (!res.ok) {
  throw new Error("Erro ao calcular cotações");
}
```

Depois:
```typescript
if (!res.ok) {
  let errorBody;
  try {
    errorBody = await res.json();
  } catch {
    errorBody = await res.text();
  }

  // Se for erro 400 de validação, criar mensagem amigável
  if (res.status === 400 && errorBody && typeof errorBody === 'object') {
    const errors = errorBody as { errors?: { fieldErrors?: Record<string, string[]> } };
    if (errors.errors?.fieldErrors) {
      const errorMessages: string[] = [];

      Object.entries(errors.errors.fieldErrors).forEach(([field, messages]) => {
        if (Array.isArray(messages)) {
          errorMessages.push(...messages);
        }
      });

      if (errorMessages.length > 0) {
        throw new Error(`Validação falhou:\n${errorMessages.join('\n')}`);
      }
    }
  }

  throw new Error(`Erro ao calcular cotações: ${res.status} ${res.statusText}`);
}
```

**Form - Mensagem de Erro Específica:**

Antes:
```typescript
catch (error) {
  message.error("Não foi possível calcular as cotações. Tente novamente.");
}
```

Depois:
```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("Validação falhou:")) {
    // Erro de validação - mostrar detalhes
    message.error({
      content: errorMessage.replace("Validação falhou:", "Verifique os dados:"),
      duration: 8,
    });
  } else {
    // Erro genérico
    message.error("Não foi possível calcular as cotações. Tente novamente.");
  }
}
```

### 3. Nova Experiência do Usuário

**Antes:**
```
❌ Não foi possível calcular as cotações. Tente novamente.
(usuário não sabe o que está errado)
```

**Depois:**
```
❌ Verifique os dados:
Comprimento mínimo: 16cm
Largura mínima: 11cm
Dimensões mínimas não atendidas (16x11x2cm)
```

## Como Usar os Logs

### 1. Abrir DevTools

**Browser Console (F12):**
```
Console > Filter: [FORM] ou [HOOK]
```

**Server Console (Terminal):**
```bash
pnpm dev
# Logs aparecem no terminal
# Filter: [API] ou [QUOTE]
```

### 2. Seguir o Fluxo

```
[FORM][FORM-123] ========== INÍCIO DO SUBMIT ==========
[FORM][FORM-123] Values recebidos: {...}
[FORM][FORM-123] Payload montado: {...}
[FORM][FORM-123] Chamando calculateQuotes.mutateAsync...

[HOOK][FE-456] Iniciando cálculo de cotações
[HOOK][FE-456] Payload: {...}
[HOOK][FE-456] Enviando POST /api/cotacoes...

[API][789-abc] POST /api/cotacoes - Início
[API][789-abc] Verificando autenticação...
[API][789-abc] Usuário autenticado: { userId: '...' }
[API][789-abc] Parseando body...
[API][789-abc] Body recebido: {...}
[API][789-abc] Validação falhou: {...}  // ← PROBLEMA AQUI

[HOOK][FE-456] Resposta recebida: { status: 400, ok: false }
[HOOK][FE-456] Erro HTTP 400: {...}

[FORM][FORM-123] ========== ERRO CAPTURADO ==========
[FORM][FORM-123] Error message: Validação falhou: ...
```

### 3. Identificar Problemas Comuns

#### Problema 1: Erro 400 - Validação

**Sintomas:**
```
[API] Validação falhou: { fieldErrors: { volumes: [...] } }
[HOOK] Erro HTTP 400
```

**Solução:**
- Verificar as mensagens de erro em `fieldErrors`
- Corrigir os dados no formulário conforme as mensagens
- Validação: comprimento ≥16cm, largura ≥11cm, altura ≥2cm

#### Problema 2: Erro 401 - Não Autenticado

**Sintomas:**
```
[API] Não autenticado
[HOOK] Erro HTTP 401
```

**Solução:**
- Fazer login novamente
- Verificar se o token JWT está válido
- Verificar cookies do navegador

#### Problema 3: Erro 500 - Erro no Servidor

**Sintomas:**
```
[API] ERRO: ...
[API] Stack: ...
[HOOK] Erro HTTP 500
```

**Solução:**
- Verificar logs do servidor (terminal)
- Identificar o erro na stack trace
- Verificar conexão com banco de dados
- Verificar se o Prisma está configurado

#### Problema 4: Parse Error

**Sintomas:**
```
[HOOK] Data recebida: {...}
[HOOK] Chamando parseQuoteResponse...
[HOOK] ERRO CAPTURADO: Resposta de cotação inválida
```

**Solução:**
- Verificar formato da resposta da API
- Verificar se `results` é um array
- Verificar se `quoteId` está presente

## Arquivos Modificados

### 1. [app/api/cotacoes/route.ts](app/api/cotacoes/route.ts)
- Adicionado `requestId` para rastreamento
- Logs detalhados em cada etapa
- Log de validação falha com detalhes completos

### 2. [hooks/useQuotes.ts](hooks/useQuotes.ts)
- Adicionado `requestId` para rastreamento
- Parseamento de erros 400 com detalhes de validação
- Mensagens de erro específicas por tipo

### 3. [components/quote/QuoteForm.tsx](components/quote/QuoteForm.tsx)
- Adicionado `requestId` para rastreamento
- Logs detalhados do fluxo de submit
- Tratamento especial para erros de validação
- Mensagem de erro com duration maior (8s)

## Validações do Backend

Schema completo em [lib/validation/quote-backend.ts](lib/validation/quote-backend.ts):

```typescript
export const volumeSchema = z
  .object({
    comprimentoCm: z.coerce
      .number()
      .int('Comprimento deve ser inteiro')
      .min(16, 'Comprimento mínimo: 16cm')
      .max(150, 'Comprimento máximo: 150cm'),

    larguraCm: z.coerce
      .number()
      .int('Largura deve ser inteira')
      .min(11, 'Largura mínima: 11cm')
      .max(150, 'Largura máxima: 150cm'),

    alturaCm: z.coerce
      .number()
      .int('Altura deve ser inteira')
      .min(2, 'Altura mínima: 2cm')
      .max(150, 'Altura máxima: 150cm'),

    pesoKg: z.coerce
      .number()
      .min(0.1, 'Peso mínimo: 0.1kg')
      .max(30, 'Peso máximo: 30kg'),
  })
  .refine(
    (data) => {
      const minDimensions = data.comprimentoCm >= 16 && data.larguraCm >= 11 && data.alturaCm >= 2;
      return minDimensions;
    },
    {
      message: 'Dimensões mínimas não atendidas (16x11x2cm)',
    }
  );
```

## Próximos Passos

### 1. Validação no Frontend

Adicionar validação no formulário **antes** de enviar para o backend:

```typescript
// No schema do React Hook Form
comprimentoCm: z.number()
  .min(16, "Mínimo: 16cm")
  .max(150, "Máximo: 150cm"),
```

**Vantagem:** Feedback imediato sem precisar chamar a API.

### 2. Remover Logs em Produção

Adicionar flag de debug:

```typescript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log(`[API][${requestId}] ...`);
}
```

### 3. Dashboard de Erros

Implementar sistema de monitoramento para capturar erros de validação:

```typescript
if (parsed.success) {
  // Track validation error
  telemetry.track('quote_validation_error', {
    fields: Object.keys(parsed.error.flatten().fieldErrors),
    userId: session.userId,
  });
}
```

## Status

✅ **Problema identificado e resolvido:**
- ✅ Logs detalhados implementados
- ✅ Erros de validação com mensagens claras
- ✅ Rastreamento com requestId
- ✅ Tratamento específico para erro 400
- ✅ Documentação completa

**Próximos testes:**
1. Testar com dimensões válidas (16x11x2cm mínimo)
2. Verificar se cotações são geradas corretamente
3. Verificar se badges "Mock" aparecem
4. Verificar se alert de aviso é exibido

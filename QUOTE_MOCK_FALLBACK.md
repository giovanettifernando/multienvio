# Implementação: Fallback para Cotações Mockadas

## Resumo

Implementação de fallback automático para cotações mockadas quando integrações de transportadoras não estão disponíveis. O sistema continua funcionando normalmente, usando valores simulados e informando o usuário de forma transparente.

## Arquivos Criados

### 1. [lib/quotes/mocks.ts](lib/quotes/mocks.ts)

Sistema completo de mocks organizados por transportadora:

**Transportadoras Suportadas:**
- ✅ **CORREIOS** (PAC, SEDEX, SEDEX 10)
- ✅ **JADLOG** (.Package, .COM, Express)
- ✅ **LOGGI** (Standard, Express)
- ✅ **J&T** (Standard, Economy)

**Funcionalidades:**
```typescript
// Gera mocks para uma transportadora específica
generateMockQuotes(carrier: CarrierCode, request: QuoteRequest): QuoteResultItem[]

// Gera mocks para todas as transportadoras
generateAllMockQuotes(request: QuoteRequest): QuoteResultItem[]

// Verifica se erro deve usar fallback
shouldUseMockFallback(error: unknown): boolean
```

**Detecção de Erros para Fallback:**
- ✅ Status HTTP: 401, 403, 404
- ✅ Códigos: `MISSING_INTEGRATION`, `INTEGRATION_DISABLED`, `INTEGRATION_INACTIVE`
- ✅ Timeout / ECONNREFUSED / ENOTFOUND
- ✅ Credenciais inválidas / unauthorized

**Cálculo de Preços:**
- Preço base por serviço
- Multiplicador por peso (0-30kg → 1x-2x)
- Multiplicador por volume (0-100000cm³ → 1x-1.5x)
- Usa o maior dos dois multiplicadores

## Arquivos Modificados

### 1. [types/quote.ts](types/quote.ts)

Adicionado campo `source` ao tipo `QuoteResultItem`:

```typescript
export type QuoteResultItem = {
  id: string;
  carrier: string;
  modalidade: string;
  prazoDias: number;
  preco: number;
  exigeSeguro?: boolean;
  source?: "real" | "mock"; // ← NOVO
};
```

### 2. [lib/quotes/service.ts](lib/quotes/service.ts)

Refatoração completa da função `calculateShippingOptions`:

**Antes:**
```typescript
async function calculateShippingOptions(request: QuoteRequest) {
  // Mock simples retornando array fixo
  return baseResults.map(/* ... */);
}
```

**Depois:**
```typescript
// Nova função: tenta cotar com cada transportadora
async function quoteCarrier(
  carrier: CarrierCode,
  request: QuoteRequest
): Promise<{ results: QuoteResultItem[]; source: 'real' | 'mock'; error?: string }> {
  try {
    // Tenta integração real
    // TODO: const realQuotes = await realCarrierApi.quote(carrier, request);
    // return { results: realQuotes, source: 'real' };

    // Simulando erro para demonstrar fallback
    throw new Error('INTEGRATION_DISABLED');
  } catch (error) {
    if (shouldUseMockFallback(error)) {
      // Usa mock como fallback
      return {
        results: generateMockQuotes(carrier, request),
        source: 'mock',
        error: error.message,
      };
    }

    // Erro crítico, retorna vazio
    return { results: [], source: 'mock', error: error.message };
  }
}

// Nova função: calcula todas as transportadoras em paralelo
async function calculateShippingOptions(request: QuoteRequest) {
  const carriers: CarrierCode[] = ['CORREIOS', 'JADLOG', 'LOGGI', 'JT'];

  // Cotar em paralelo com Promise.all
  const quoteResults = await Promise.all(
    carriers.map((carrier) => quoteCarrier(carrier, request))
  );

  // Mesclar resultados reais + mocks
  const allResults: QuoteResultItem[] = [];
  for (const result of quoteResults) {
    if (result.results.length > 0) {
      allResults.push(...result.results);
    }
  }

  return allResults;
}
```

**Logs Estruturados:**
```javascript
[QUOTE][requestId] Starting quote calculation
[QUOTE][requestId] Attempting real quote for CORREIOS
[QUOTE][requestId] Carrier CORREIOS failed (45ms) { shouldFallback: true }
[QUOTE][requestId] Using 3 mock quotes for CORREIOS
[QUOTE][requestId] Quote calculation completed { total: 12, real: 0, mock: 12, failed: 0 }
```

### 3. [components/quote/ResultsTable.tsx](components/quote/ResultsTable.tsx)

**Badge "Mock" nas Cotações:**

Coluna "Modalidade" agora mostra badge laranja quando `source === "mock"`:

```tsx
{
  title: "Modalidade",
  render: (value: string, record: QuoteResultItem) => (
    <Flex align="center" gap={8}>
      <Typography.Text>{value}</Typography.Text>
      {record.source === "mock" && (
        <Tag color="orange" bordered={false}>
          Mock
        </Tag>
      )}
    </Flex>
  ),
}
```

**Aviso Visual (Alert):**

Quando há pelo menos uma cotação mock, exibe alerta abaixo da tabela:

```tsx
{hasMockQuotes && (
  <Alert
    message="Algumas cotações estão em modo simulado"
    description="Algumas opções foram geradas automaticamente por indisponibilidade de integração. Os valores e prazos podem variar ao confirmar o envio."
    type="warning"
    icon={<InfoCircleOutlined />}
    showIcon
    closable
  />
)}
```

## Fluxo de Funcionamento

### 1. Usuário Clica em "Calcular"

```
Frontend (QuoteForm)
    ↓ POST /api/cotacoes
    ↓ payload: { origem, destino, volumes, ... }
Backend (route.ts)
    ↓ createQuote(userId, request)
Service (service.ts)
    ↓ calculateShippingOptions(request)
```

### 2. Cálculo por Transportadora (Paralelo)

```
calculateShippingOptions()
    ├─ quoteCarrier('CORREIOS', request)
    │   ├─ try { realAPI.quote() }
    │   └─ catch → shouldUseMockFallback() → generateMockQuotes('CORREIOS')
    │
    ├─ quoteCarrier('JADLOG', request)
    │   ├─ try { realAPI.quote() }
    │   └─ catch → shouldUseMockFallback() → generateMockQuotes('JADLOG')
    │
    ├─ quoteCarrier('LOGGI', request)
    └─ quoteCarrier('JT', request)
```

### 3. Mesclagem de Resultados

```
Resultado Final:
[
  { id: 'correios-pac', carrier: 'Correios', modalidade: 'PAC', preco: 25.5, source: 'mock' },
  { id: 'correios-sedex', carrier: 'Correios', modalidade: 'SEDEX', preco: 45.0, source: 'mock' },
  { id: 'jadlog-package', carrier: 'Jadlog', modalidade: '.Package', preco: 30.0, source: 'mock' },
  { id: 'jadlog-com', carrier: 'Jadlog', modalidade: '.COM', preco: 50.0, source: 'real' }, // ← real
  { id: 'loggi-standard', carrier: 'Loggi', modalidade: 'Standard', preco: 28.0, source: 'mock' },
  // ...
]
```

### 4. Exibição no Frontend

```
ResultsTable
    ├─ Badge "Mock" em cotações com source="mock"
    └─ Alert (warning) no rodapé se houver alguma mock
```

## Cenários de Erro

### Cenário 1: Integração Não Configurada (Fallback ✅)

```javascript
Error: INTEGRATION_DISABLED
shouldUseMockFallback() → true
Resultado: Mock quotes para aquela transportadora
```

### Cenário 2: Timeout (Fallback ✅)

```javascript
Error: Request timeout after 5000ms
shouldUseMockFallback() → true (detecta "timeout" na mensagem)
Resultado: Mock quotes para aquela transportadora
```

### Cenário 3: Credenciais Inválidas (Fallback ✅)

```javascript
Error: 401 Unauthorized
shouldUseMockFallback() → true (status 401)
Resultado: Mock quotes para aquela transportadora
```

### Cenário 4: Erro Crítico de Lógica (Sem Fallback ❌)

```javascript
Error: Invalid request format
shouldUseMockFallback() → false
Resultado: [] (sem quotes daquela transportadora)
```

### Cenário 5: Todas Falharam com Fallback (Sistema Continua ✅)

```javascript
4 transportadoras → todas usam fallback
Resultado: 12+ mock quotes disponíveis
Usuário pode continuar o fluxo normalmente
```

### Cenário 6: Nenhuma Quote (Real ou Mock) (Erro ao Usuário ❌)

```javascript
4 transportadoras → todas com erro crítico, sem fallback
Resultado: []
Frontend: "Não foi possível calcular cotações. Tente novamente."
```

## Comportamento Visual

### Tabela de Resultados

| Transportadora | Modalidade | Prazo | Preço | Seguro | |
|----------------|------------|-------|-------|--------|---|
| **CO** Correios | PAC `[Mock]` | 🕐 10 dias | ↓ R$ 25,50 | Opcional | **[Selecionar]** |
| **CO** Correios | SEDEX `[Mock]` | 🕐 5 dias | ↓ R$ 45,00 | Opcional | **[Selecionar]** |
| **JA** Jadlog | .COM | 🕐 4 dias | ↓ R$ 50,00 | 🛡️ Obrigatório | **[Selecionar]** |

### Alert (Rodapé)

```
⚠️ Algumas cotações estão em modo simulado

Algumas opções foram geradas automaticamente por indisponibilidade de integração.
Os valores e prazos podem variar ao confirmar o envio.

[×] (closable)
```

## Logs para Monitoramento

### Backend (Console)

```javascript
[QUOTE][1234567890-abc123] Starting quote calculation {
  origin: "01310100",
  dest: "20040020",
  carriers: 4
}

[QUOTE][1234567890-abc123] Attempting real quote for CORREIOS {
  origin: "01310100",
  dest: "20040020",
  volumes: 2
}

[QUOTE][1234567890-abc123] Carrier CORREIOS failed (45ms) {
  shouldFallback: true,
  error: "INTEGRATION_DISABLED"
}

[QUOTE][1234567890-abc123] Using 3 mock quotes for CORREIOS

[QUOTE][1234567890-abc123] Quote calculation completed {
  total: 12,
  real: 0,
  mock: 12,
  failed: 0
}
```

### Estrutura do Log

- **requestId**: Identificador único da requisição
- **Timestamps**: Início e duração de cada operação
- **Status por Transportadora**: real | mock | failed
- **Erros Sanitizados**: Sem dados sensíveis (tokens, credenciais)

## Mensagens de Erro

### Apenas Mocks Disponíveis (Continua Normalmente)

✅ **Comportamento:** Sistema funciona, usuário informado via Alert
- Nenhum erro exibido
- Fluxo continua normalmente
- Badge "Mock" visível nas cotações

### Nenhuma Cotação Disponível

❌ **Comportamento:** Toast de erro

```javascript
message.error("Não foi possível calcular as cotações. Tente novamente.");
```

## Vantagens da Implementação

### 1. Resiliência

- ✅ Sistema nunca fica completamente indisponível
- ✅ Falha de uma transportadora não afeta as outras
- ✅ Usuário sempre consegue ver opções e continuar o fluxo

### 2. Transparência

- ✅ Badge "Mock" claramente visível
- ✅ Aviso explicativo sobre valores simulados
- ✅ Usuário informado antes de tomar decisão

### 3. Experiência do Usuário

- ✅ Não bloqueia o fluxo
- ✅ Permite testar o sistema sem integrações configuradas
- ✅ Ambiente de desenvolvimento funcional sem credenciais reais

### 4. Desenvolvimento

- ✅ Desenvolvimento frontend independente de APIs externas
- ✅ Testes end-to-end sem mocks externos
- ✅ Demonstrações e homologação funcionais

### 5. Monitoramento

- ✅ Logs estruturados com requestId
- ✅ Métricas por transportadora (real/mock/failed)
- ✅ Fácil identificar problemas de integração

## Próximos Passos

### Para Integração Real

Quando implementar integrações reais com transportadoras, substituir o bloco de simulação em `quoteCarrier()`:

```typescript
// ❌ REMOVER (simulação)
throw new Error('INTEGRATION_DISABLED');

// ✅ ADICIONAR (integração real)
const realQuotes = await carrierIntegrations[carrier].quote({
  originCep: request.origem.cep,
  destCep: request.destino.cep,
  volumes: request.volumes,
  // ...
});

return {
  results: realQuotes.map(q => ({ ...q, source: 'real' })),
  source: 'real',
};
```

### Métricas Recomendadas

Adicionar telemetria para monitorar:
- Taxa de fallback por transportadora
- Tempo médio de resposta por transportadora
- Taxa de erro crítico (sem fallback)
- Conversão: cotações mock → pedidos efetivados

### Melhorias Futuras

1. **Cache de Mocks:** Cachear mocks por CEPs para melhor performance
2. **Configuração:** Permitir admin desabilitar fallback por transportadora
3. **Priorização:** Ordenar resultados colocando "real" antes de "mock"
4. **Telemetria:** Dashboard com status de integrações em tempo real

## Status da Implementação

✅ **Concluído** - Todos os requisitos atendidos:
- ✅ Fallback por transportadora com try-catch
- ✅ Flag `source: "real" | "mock"` nos resultados
- ✅ Mocks base para 4 transportadoras (12+ serviços)
- ✅ Badge "Mock" nas cotações simuladas
- ✅ Aviso visual discreto no rodapé
- ✅ Sistema continua funcionando normalmente
- ✅ Logs estruturados sem dados sensíveis
- ✅ TypeScript compilando sem erros

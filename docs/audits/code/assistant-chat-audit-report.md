# Relatório de Auditoria - Chat Assistente IA

**Data:** 2025-01-17  
**Escopo:** Análise completa da rotina do chat Assistente  
**Objetivo:** Identificar erros, problemas e propor melhorias

---

## 📋 Sumário Executivo

Este relatório apresenta uma análise detalhada do sistema de chat do Assistente IA, incluindo:
- Componente React (`AssistantChat.tsx`)
- API Route (`/api/assistant/chat`)
- Orquestrador de ferramentas (`orchestrator.ts`)
- Executores de ferramentas (`executors.ts`)
- Definições de ferramentas (`definitions.ts`)
- Sistema de debug (`debug.ts`)
- Gerenciamento de sessões
- Integração com OpenRouter

**Status Geral:** ⚠️ Sistema funcional, mas com várias oportunidades de melhoria em segurança, performance, UX e robustez.

---

## 🔴 Problemas Críticos

### 1. **Race Condition no Cache de Idempotência**

**Localização:** `app/api/assistant/chat/route.ts:44-58`

**Problema:**
- Cache de idempotência é in-memory (`Map`) e não é compartilhado entre instâncias do servidor
- Em ambiente com múltiplas instâncias (load balancer), o cache não funciona corretamente
- Cleanup periódico pode causar race conditions

**Impacto:** 
- Alto - Requisições duplicadas podem ser processadas em ambientes distribuídos
- Cache pode crescer indefinidamente se o cleanup falhar

**Recomendação:**
```typescript
// Usar Redis para cache distribuído
import { getRedisClient } from '@/lib/redis';

const idempotencyCache = getRedisClient();
const IDEMPOTENCY_TTL_MS = 60_000;

// Usar SET com EX para TTL automático
await idempotencyCache.set(
  `assistant:idempotency:${requestId}`,
  JSON.stringify(cachedData),
  'EX',
  Math.ceil(IDEMPOTENCY_TTL_MS / 1000)
);
```

---

### 2. **Memory Leak no Set de Requisições em Progresso**

**Localização:** `app/api/assistant/chat/route.ts:58, 248-500`

**Problema:**
- `inProgressRequests` é um `Set` in-memory que nunca é limpo em caso de erro não tratado
- Se uma requisição falhar antes do `finally`, o requestId permanece no Set indefinidamente
- Pode causar negação de serviço (DoS) se muitos requestIds ficarem presos

**Impacto:**
- Alto - Pode causar vazamento de memória e bloquear requisições legítimas

**Recomendação:**
```typescript
// Adicionar timeout automático
const IN_PROGRESS_TTL_MS = 300_000; // 5 minutos

inProgressRequests.add(requestId);

// Timeout de segurança
const timeoutId = setTimeout(() => {
  inProgressRequests.delete(requestId);
  logger.warn({ requestId }, 'Request timeout - removed from in-progress set');
}, IN_PROGRESS_TTL_MS);

try {
  // ... código existente
} finally {
  clearTimeout(timeoutId);
  inProgressRequests.delete(requestId);
}
```

---

### 3. **Falta de Validação de Tamanho de Mensagens no Histórico**

**Localização:** `app/api/assistant/chat/route.ts:120-135`

**Problema:**
- `loadSessionHistory` carrega até 20 mensagens sem verificar tamanho total
- Pode exceder limites de tokens do LLM se histórico for muito grande
- Não há truncamento inteligente (manter mensagens mais recentes)

**Impacto:**
- Médio - Pode causar erros 400 (token limit exceeded) ou custos desnecessários

**Recomendação:**
```typescript
async function loadSessionHistory(
  sessionId: string,
  maxTokens: number = 4000
): Promise<OpenRouterMessage[]> {
  const messages = await prisma.assistantChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' }, // Mais recentes primeiro
    take: 50, // Buscar mais para ter opções
  });

  // Reverter ordem para cronológica
  messages.reverse();

  // Truncar inteligentemente mantendo mensagens mais recentes
  const selected: OpenRouterMessage[] = [];
  let totalTokens = 0;

  for (const msg of messages) {
    const estimatedTokens = Math.ceil(msg.content.length / 4); // ~4 chars/token
    if (totalTokens + estimatedTokens > maxTokens) break;
    
    selected.push({
      role: msg.author === 'USER' ? 'user' : 'assistant',
      content: msg.content,
    });
    totalTokens += estimatedTokens;
  }

  return selected;
}
```

---

### 4. **Falta de Rate Limiting Específico para Assistente**

**Localização:** `app/api/assistant/chat/route.ts`

**Problema:**
- Não há rate limiting específico para o endpoint do assistente
- Usuários podem fazer requisições excessivas, causando:
  - Custos elevados com OpenRouter
  - Sobrecarga do servidor
  - Experiência ruim para outros usuários

**Impacto:**
- Alto - Risco de abuso e custos descontrolados

**Recomendação:**
```typescript
import { rateLimitRedis } from '@/lib/rate-limit-redis';

// No início do handler
const rateLimitKey = `assistant:rate-limit:${userId}`;
const limit = await rateLimitRedis.checkLimit(rateLimitKey, {
  maxRequests: 30, // 30 requisições
  windowMs: 60_000, // por minuto
});

if (!limit.allowed) {
  throw new ApiError({
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Muitas requisições. Aguarde um momento antes de tentar novamente.',
    status: 429,
  });
}
```

---

## 🟡 Problemas Importantes

### 5. **Estado de Mensagens Não Persistido no Frontend**

**Localização:** `components/assistant/AssistantChat.tsx:91`

**Problema:**
- Mensagens são armazenadas apenas em estado React (`useState`)
- Ao recarregar a página, todas as mensagens são perdidas
- Usuário precisa esperar carregar histórico do servidor

**Impacto:**
- Médio - UX ruim, especialmente em conexões lentas

**Recomendação:**
```typescript
// Usar localStorage para cache local
const STORAGE_KEY = `assistant:messages:${sessionId}`;

// Salvar mensagens
useEffect(() => {
  if (sessionId && messages.length > 1) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }
}, [messages, sessionId]);

// Carregar mensagens ao montar
useEffect(() => {
  if (sessionId) {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setMessages(parsed);
      } catch {
        // Ignora erro de parse
      }
    }
  }
}, [sessionId]);
```

---

### 6. **Falta de Feedback Visual Durante Tool Execution**

**Localização:** `components/assistant/AssistantChat.tsx:404-418`

**Problema:**
- Indicador de "digitando" é genérico
- Usuário não sabe que ferramentas estão sendo executadas
- Não há progresso ou status das operações

**Impacto:**
- Médio - UX pode ser confusa, especialmente em requisições longas

**Recomendação:**
```typescript
interface Message {
  // ... campos existentes
  toolCalls?: Array<{
    name: string;
    status: 'pending' | 'executing' | 'completed' | 'error';
  }>;
}

// Mostrar status das tools em tempo real
{message.toolCalls?.map((tool, idx) => (
  <div key={idx} className={styles.toolStatus}>
    <ToolOutlined />
    <span>
      {tool.status === 'executing' && 'Consultando...'}
      {tool.status === 'completed' && 'Concluído'}
      {tool.name}
    </span>
  </div>
))}
```

---

### 7. **Tratamento de Erro Genérico Demais**

**Localização:** `components/assistant/AssistantChat.tsx:271-298`

**Problema:**
- Todas as mensagens de erro são genéricas: "Desculpe, ocorreu um erro..."
- Usuário não sabe se foi erro de rede, servidor, ou limite de taxa
- Não há diferenciação entre erros recuperáveis e não recuperáveis

**Impacto:**
- Médio - UX ruim, usuário não sabe como resolver

**Recomendação:**
```typescript
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Rate limit
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return 'Muitas requisições. Aguarde alguns segundos antes de tentar novamente.';
    }
    
    // Network error
    if (error.name === 'AbortError' || error.message.includes('fetch')) {
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
    
    // Server error
    if (error.message.includes('500') || error.message.includes('503')) {
      return 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';
    }
    
    // Validation error
    if (error.message.includes('400') || error.message.includes('validation')) {
      return 'Mensagem inválida. Verifique o conteúdo e tente novamente.';
    }
  }
  
  return 'Desculpe, ocorreu um erro. Tente novamente.';
};
```

---

### 8. **Falta de Retry Automático no Frontend**

**Localização:** `components/assistant/AssistantChat.tsx:218-232`

**Problema:**
- Não há retry automático para erros de rede
- Usuário precisa clicar manualmente para tentar novamente
- Erros transitórios não são recuperados automaticamente

**Impacto:**
- Médio - UX ruim em conexões instáveis

**Recomendação:**
```typescript
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const sendWithRetry = async (attempt = 1): Promise<ChatResponse> => {
  try {
    return await fetch("/api/assistant/chat", { /* ... */ });
  } catch (error) {
    if (attempt < MAX_RETRIES && isRetryableError(error)) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      return sendWithRetry(attempt + 1);
    }
    throw error;
  }
};
```

---

### 9. **Falta de Validação de Argumentos de Tools**

**Localização:** `lib/assistant/tools/executors.ts:647-680`

**Problema:**
- `executeTool` faz type casting direto sem validação
- Argumentos inválidos podem causar erros em runtime
- Não há validação de schema antes de executar

**Impacto:**
- Médio - Pode causar erros inesperados e respostas ruins do LLM

**Recomendação:**
```typescript
import { z } from 'zod';

// Definir schemas de validação para cada tool
const listarEnviosSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED']).optional(),
  periodo_dias: z.number().min(1).max(365).optional(),
  limite: z.number().min(1).max(20).optional(),
  busca: z.string().optional(),
});

export async function executeTool(
  toolName: AssistantToolName,
  args: unknown,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    // Validar argumentos antes de executar
    let validatedArgs: unknown;
    
    switch (toolName) {
      case 'listar_envios':
        validatedArgs = listarEnviosSchema.parse(args);
        return executeListarEnvios(ctx, validatedArgs as ListarEnviosArgs);
      // ... outros cases
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Argumentos inválidos: ${error.errors.map(e => e.message).join(', ')}`,
      };
    }
    throw error;
  }
}
```

---

### 10. **Limite de Iterações de Tools Muito Restritivo**

**Localização:** `lib/assistant/tools/orchestrator.ts:36`

**Problema:**
- `MAX_TOOL_ITERATIONS = 2` é muito baixo para consultas complexas
- Pode não ser suficiente para:
  - Buscar envio → Consultar detalhes → Buscar rastreamento
  - Consultar saldo → Listar transações → Verificar ticket relacionado

**Impacto:**
- Médio - Limita capacidade do assistente em resolver problemas complexos

**Recomendação:**
```typescript
// Aumentar para 3-4 iterações
const MAX_TOOL_ITERATIONS = 4;

// OU implementar limite dinâmico baseado em complexidade
const getMaxIterations = (message: string): number => {
  const complexKeywords = ['detalhes', 'histórico', 'rastreamento', 'transações'];
  const isComplex = complexKeywords.some(kw => message.toLowerCase().includes(kw));
  return isComplex ? 4 : 2;
};
```

---

### 11. **Falta de Logging Estruturado para Auditoria**

**Localização:** Múltiplos arquivos

**Problema:**
- Logs não incluem informações suficientes para auditoria
- Não há rastreamento de:
  - Quais tools foram usadas por usuário
  - Custos de tokens por requisição
  - Tempo de resposta por tool
  - Taxa de erro por tool

**Impacto:**
- Médio - Dificulta monitoramento e otimização

**Recomendação:**
```typescript
// Criar serviço de métricas
interface AssistantMetrics {
  userId: string;
  requestId: string;
  sessionId: string;
  toolsUsed: string[];
  totalTokens: number;
  durationMs: number;
  costEstimate: number; // baseado em preço do modelo
  success: boolean;
}

async function logMetrics(metrics: AssistantMetrics) {
  await prisma.assistantMetrics.create({
    data: {
      userId: metrics.userId,
      requestId: metrics.requestId,
      sessionId: metrics.sessionId,
      toolsUsed: metrics.toolsUsed,
      totalTokens: metrics.totalTokens,
      durationMs: metrics.durationMs,
      costEstimate: metrics.costEstimate,
      success: metrics.success,
      createdAt: new Date(),
    },
  });
}
```

---

### 12. **Falta de Timeout na Requisição do Frontend**

**Localização:** `components/assistant/AssistantChat.tsx:219-232`

**Problema:**
- `fetch` não tem timeout explícito
- Requisições podem ficar pendentes indefinidamente
- `AbortController` só funciona se usuário fechar o chat

**Impacto:**
- Médio - Pode causar requisições "zombie" e consumo de recursos

**Recomendação:**
```typescript
const REQUEST_TIMEOUT_MS = 60_000; // 60 segundos

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

try {
  const response = await fetch("/api/assistant/chat", {
    // ... outras opções
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  // ... processar resposta
} catch (error) {
  clearTimeout(timeoutId);
  if (error instanceof Error && error.name === 'AbortError') {
    setError('Tempo de resposta excedido. Tente novamente.');
  }
  // ... outros erros
}
```

---

## 🟢 Melhorias Recomendadas

### 13. **Adicionar Suporte a Streaming de Respostas**

**Localização:** `app/api/assistant/chat/route.ts`

**Benefício:**
- Melhor UX - usuário vê resposta sendo gerada em tempo real
- Percepção de velocidade melhorada
- Reduz tempo de espera percebido

**Implementação:**
```typescript
// Usar chatCompletionStream do OpenRouter
const stream = await chatCompletionStream(/* ... */);

// Retornar ReadableStream
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

---

### 14. **Adicionar Suporte a Múltiplas Sessões**

**Localização:** `components/assistant/AssistantChat.tsx`

**Benefício:**
- Usuário pode ter múltiplas conversas simultâneas
- Melhor organização para diferentes tópicos
- Histórico mais organizado

**Implementação:**
```typescript
interface Session {
  id: string;
  title: string;
  lastMessageAt: Date;
  unreadCount: number;
}

const [sessions, setSessions] = useState<Session[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

// Adicionar UI para trocar entre sessões
```

---

### 15. **Adicionar Busca no Histórico de Mensagens**

**Localização:** `components/assistant/AssistantChat.tsx`

**Benefício:**
- Usuário pode encontrar mensagens antigas rapidamente
- Melhor navegação em conversas longas

**Implementação:**
```typescript
const [searchQuery, setSearchQuery] = useState('');

const filteredMessages = messages.filter(msg =>
  msg.content.toLowerCase().includes(searchQuery.toLowerCase())
);
```

---

### 16. **Adicionar Exportação de Conversas**

**Localização:** `app/api/assistant/sessions/[id]/route.ts`

**Benefício:**
- Usuário pode salvar conversas importantes
- Suporte para referência futura
- Compliance e auditoria

**Implementação:**
```typescript
// Adicionar endpoint para exportar em PDF ou TXT
export const GET = withApiHandler(async (context) => {
  // ... buscar sessão
  // Gerar PDF ou TXT com todas as mensagens
  return new Response(/* arquivo */, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="conversa-${sessionId}.pdf"`,
    },
  });
});
```

---

### 17. **Melhorar Acessibilidade**

**Localização:** `components/assistant/AssistantChat.tsx`

**Problemas:**
- Falta `aria-live` para anunciar novas mensagens
- Falta `role="log"` no container de mensagens
- Falta navegação por teclado entre mensagens

**Recomendação:**
```typescript
<div
  className={styles.messages}
  role="log"
  aria-live="polite"
  aria-label="Mensagens do chat"
>
  {/* mensagens */}
</div>

// Adicionar navegação por teclado
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Navegar entre mensagens
    }
  };
  // ...
}, []);
```

---

### 18. **Adicionar Indicador de Custo/Tokens**

**Localização:** `components/assistant/AssistantChat.tsx`

**Benefício:**
- Transparência para usuário sobre uso de recursos
- Pode ajudar a reduzir uso desnecessário

**Implementação:**
```typescript
interface ChatResponse {
  // ... campos existentes
  tokensUsed?: number;
  costEstimate?: number;
}

// Mostrar no header ou footer do chat
<div className={styles.stats}>
  <span>Tokens: {totalTokens}</span>
  <span>Custo: R$ {totalCost.toFixed(4)}</span>
</div>
```

---

### 19. **Adicionar Suporte a Anexos/Imagens**

**Localização:** Múltiplos arquivos

**Benefício:**
- Usuário pode enviar screenshots de problemas
- Melhor contexto para o assistente
- Suporte mais eficiente

**Implementação:**
```typescript
// Adicionar input de arquivo
<input
  type="file"
  accept="image/*"
  onChange={handleFileUpload}
/>

// Enviar como base64 ou URL
const imageData = await convertToBase64(file);
messages.push({
  role: 'user',
  content: [
    { type: 'text', text: message },
    { type: 'image_url', image_url: { url: imageData } },
  ],
});
```

---

### 20. **Adicionar Cache de Respostas Frequentes**

**Localização:** `app/api/assistant/chat/route.ts`

**Benefício:**
- Reduz custos com OpenRouter
- Respostas mais rápidas para perguntas comuns
- Melhor experiência do usuário

**Implementação:**
```typescript
// Cache de respostas para perguntas frequentes
const FAQ_CACHE_KEY = `assistant:faq:${hashMessage(message)}`;
const cached = await redis.get(FAQ_CACHE_KEY);

if (cached) {
  return JSON.parse(cached);
}

// Após gerar resposta, cachear se for FAQ
if (isFAQ(message)) {
  await redis.set(FAQ_CACHE_KEY, JSON.stringify(response), 'EX', 86400); // 24h
}
```

---

## 📊 Métricas e Monitoramento

### Métricas Recomendadas

1. **Performance:**
   - Tempo médio de resposta (p50, p95, p99)
   - Taxa de timeout
   - Taxa de erro por tipo

2. **Custos:**
   - Tokens consumidos por dia/semana/mês
   - Custo estimado por requisição
   - Custo por usuário

3. **Uso:**
   - Requisições por usuário
   - Tools mais usadas
   - Sessões ativas

4. **Qualidade:**
   - Taxa de sucesso de tools
   - Taxa de iterações até resposta
   - Taxa de fallback

---

## 🔒 Segurança

### Problemas de Segurança Identificados

1. **✅ RBAC Implementado Corretamente**
   - Todas as tools verificam `ctx.userId`
   - Sessões são isoladas por usuário

2. **⚠️ Falta de Sanitização de Input**
   - Mensagens do usuário são enviadas diretamente ao LLM
   - Pode conter conteúdo malicioso ou injection

3. **⚠️ Falta de Validação de Tamanho**
   - Mensagens podem ser muito grandes
   - Pode causar DoS ou custos elevados

**Recomendação:**
```typescript
// Sanitizar mensagem antes de processar
function sanitizeMessage(message: string): string {
  // Remover caracteres de controle
  let sanitized = message.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limitar tamanho
  if (sanitized.length > 10000) {
    sanitized = sanitized.slice(0, 10000) + '...';
  }
  
  // Validar encoding
  try {
    return new TextEncoder().encode(sanitized).length <= 10000
      ? sanitized
      : sanitized.slice(0, 5000);
  } catch {
    return '';
  }
}
```

---

## 🎯 Priorização de Correções

### Alta Prioridade (Fazer Imediatamente)
1. ✅ Cache de idempotência com Redis
2. ✅ Memory leak no Set de requisições
3. ✅ Rate limiting específico
4. ✅ Timeout nas requisições do frontend

### Média Prioridade (Próximas Sprints)
5. ✅ Validação de argumentos de tools
6. ✅ Tratamento de erro melhorado
7. ✅ Persistência de mensagens no frontend
8. ✅ Logging estruturado para métricas

### Baixa Prioridade (Backlog)
9. ✅ Streaming de respostas
10. ✅ Múltiplas sessões
11. ✅ Busca no histórico
12. ✅ Exportação de conversas

---

## 📝 Conclusão

O sistema de chat do Assistente está **funcional e bem estruturado**, mas possui várias oportunidades de melhoria:

**Pontos Fortes:**
- ✅ Arquitetura bem separada (orchestrator, executors, definitions)
- ✅ Sistema de debug robusto
- ✅ RBAC implementado corretamente
- ✅ Tratamento de erros básico presente

**Pontos Fracos:**
- ⚠️ Cache in-memory não escala
- ⚠️ Falta rate limiting
- ⚠️ UX pode ser melhorada (feedback, retry, etc.)
- ⚠️ Falta monitoramento e métricas

**Recomendação Final:**
Priorizar correções de alta prioridade (cache distribuído, rate limiting, timeouts) antes de adicionar novas features. Isso garantirá que o sistema seja robusto e escalável antes de expandir funcionalidades.

---

**Relatório gerado por:** Auto (AI Assistant)  
**Data:** 2025-01-17


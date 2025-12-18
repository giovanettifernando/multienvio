# Padrões de API — Envio Legal

## Convenções Gerais
- **Prefixo:** todas as rotas vivem sob `/api/*`; a versão é implícita (`v1` virtual) e novas versões devem ser adicionadas via novo prefixo (`/api/v2/*`).
- **Handler wrapper:** utilize `withApiHandler` (`@/lib/api/handler`) em cada método para obter logging estruturado, tratamento de erros e resposta consistente.
- **Camadas:** `Route Handler` → `Service` → `Repository`. Repositórios podem operar em memória e persistir em arquivos JSON dentro de `data/`.
- **Logs por requisição:** cada request gera um `requestId` (aceita `x-request-id` de entrada). O logger (`createRequestLogger`) registra eventos `request.received`, `request.completed` e `request.failed`, além de eventos customizados (`audit`, `info`, `warn`, `debug`).

## Estrutura de Resposta
```json
// Sucesso (payload de exemplo)
{
  "data": { "sample": "value" },
  "error": null,
  "meta": {
    "requestId": "uuid",
    "method": "GET",
    "path": "/api/...",
    "timestamp": "2025-10-28T22:17:38.277Z",
    "durationMs": 4,
    "...": "extras opcionais"
  }
}

// Erro
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Falha de validação.",
    "requestId": "uuid",
    "details": { "...": "dados adicionais" }
  },
  "meta": {
    "requestId": "uuid",
    "method": "PUT",
    "path": "/api/...",
    "timestamp": "2025-10-28T22:17:38.277Z",
    "durationMs": 7
  }
}
```

## Rotas Implementadas

### `GET /api/health`
- **Descrição:** verificação de integridade do serviço.
- **Resposta 200:**
  ```json
  {
    "data": {
      "status": "ok",
      "timestamp": "2025-10-28T22:17:38.277Z",
      "uptimeSeconds": 1234.567,
      "startedAt": "2025-10-28T21:17:00.000Z",
      "version": "0.1.0",
      "commit": "local",
      "environment": "development"
    },
    "error": null,
    "meta": {
      "requestId": "uuid",
      "method": "GET",
      "path": "/api/health",
      "timestamp": "2025-10-28T22:17:38.277Z",
      "durationMs": 2,
      "tags": ["health"]
    }
  }
  ```

### `GET /api/system/status`
- **Descrição:** consulta a bandeira de manutenção e mensagem informativa (persistida em `data/system-status.json`).
- **Resposta 200:**
  ```json
  {
    "data": {
      "maintenance": false,
      "message": "Serviços operacionais.",
      "updatedAt": "2025-10-28T22:15:40.100Z"
    },
    "error": null,
    "meta": {
      "requestId": "uuid",
      "method": "GET",
      "path": "/api/system/status",
      "timestamp": "2025-10-28T22:17:38.277Z",
      "durationMs": 3,
      "tags": ["system", "status"]
    }
  }
  ```

### `PUT /api/system/status`
- **Descrição:** atualiza sinalização de manutenção e mensagem exibida aos usuários.
- **Payload:**
  ```json
  {
    "maintenance": true,
    "message": "Janela de manutenção programada."
  }
  ```
  - `maintenance` *(boolean, opcional)*: liga/desliga modo manutenção.
  - `message` *(string, opcional, 1-280 chars)*: mensagem exibida no frontend.
- **Resposta 200:** mesmo contrato do `GET`, refletindo novos valores.
- **Erros principais:**
  - `400 BAD_REQUEST` — JSON inválido ou body vazio.
  - `422 VALIDATION_ERROR` — violações de schema (detalhes vêm no campo `details`).

## Erros Padronizados
- Utilize `ApiError` (`@/lib/api/errors`) para lançar erros com `code`, `status` e `details`.
- Métodos helper disponíveis: `badRequest`, `validation`, `notFound`, `unauthorized`, `forbidden`.

## Logs
- Eventos automáticos:
  - `request.received` — inclui querystring.
  - `request.completed` — inclui status final e `durationMs`.
  - `request.failed` — inclui `code` e mensagem de erro.
- Eventos customizados: use `logger.audit("domínio.evento", {...})` para ações sensíveis (e.g. alterações administrativas).

---

## Padrão de Validação de Input

### Princípios

1. **Toda rota de mutação (POST/PUT/PATCH/DELETE) deve validar inputs**
2. **Usar Zod para schemas de validação**
3. **Falhar cedo (fail-fast) com mensagens claras**
4. **Sanitizar strings antes de processar**

### Estrutura Recomendada

```typescript
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { validateIdParam } from '@/lib/validation/utils';

// 1. Definir schema Zod
const CreateItemSchema = z.object({
  name: z.string().min(1).max(100).transform(v => v.trim()),
  email: z.string().email().toLowerCase(),
  quantity: z.number().int().positive().max(1000),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// 2. Handler com validação
export const POST = withApiHandler<ResponseType, { id: string }>(async (context) => {
  const { req, params } = context;

  // Validar parâmetros de rota (UUID/CUID)
  const parentId = validateIdParam(params.id, 'id');

  // Parse e validar body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    throw ApiError.badRequest('JSON inválido');
  }

  const parseResult = CreateItemSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const errors = parseResult.error.issues
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw ApiError.validation(`Dados inválidos: ${errors}`);
  }

  const data = parseResult.data;
  // ... processar data validado
});
```

### Validação de Parâmetros de Rota

```typescript
import { validateIdParam, validateIdParams } from '@/lib/validation/utils';

// Validar um ID
const id = validateIdParam(params.id); // Lança ApiError se inválido

// Validar múltiplos IDs
const { userId, cardId } = validateIdParams(params, ['userId', 'cardId']);
```

### Sanitização de Strings

```typescript
const schema = z.object({
  // Remover espaços extras
  name: z.string().transform(v => v.trim().replace(/\s+/g, ' ')),

  // Normalizar email
  email: z.string().email().toLowerCase().trim(),

  // Limitar tamanho e remover caracteres perigosos
  description: z.string()
    .max(1000)
    .transform(v => v.trim())
    .refine(v => !/<script/i.test(v), 'Conteúdo inválido'),

  // CEP: apenas dígitos
  cep: z.string().transform(v => v.replace(/\D/g, '')).length(8),

  // UF: uppercase
  uf: z.string().length(2).toUpperCase(),
});
```

### Validação de Webhooks

Para endpoints que recebem dados de serviços externos:

```typescript
// Schema permissivo mas validado
const WebhookSchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string().max(100),
  data: z.object({}).passthrough(), // Aceita campos extras
}).passthrough();

// Sempre validar antes de processar
const parseResult = WebhookSchema.safeParse(rawPayload);
if (!parseResult.success) {
  logger.warn({ errors: parseResult.error.issues }, 'Invalid webhook payload');
  throw ApiError.badRequest('Payload inválido');
}
```

### Schemas Centralizados

Schemas reutilizáveis ficam em `lib/validation/`:

- `auth.ts` - login, registro, reset de senha
- `card.ts` - criação/atualização de cartões
- `recipient.ts` - destinatários
- `address.ts` - endereços
- `profile.ts` - perfil de usuário
- `shipment.ts` - envios
- `utils.ts` - validadores auxiliares (CPF, CNPJ, UUID, etc.)

### Checklist para Novas Rotas

- [ ] Schema Zod definido para o body (POST/PUT/PATCH)
- [ ] Parâmetros de rota validados com `validateIdParam`
- [ ] Strings sanitizadas (trim, lowercase onde aplicável)
- [ ] Limites de tamanho definidos para strings e arrays
- [ ] Mensagens de erro claras e em português
- [ ] Dados sensíveis não logados

---

## Padrão de Cache Redis

### Arquitetura

O projeto utiliza Redis para cache de dados frequentemente acessados, com estratégia **cache-aside** e **fail-open** (sistema continua funcionando se Redis estiver indisponível).

**Arquivos principais:**
- `lib/redis.ts` - Cliente Redis com circuit breaker
- `lib/cache.ts` - Utilitários de cache e helpers de domínio

### TTLs Configurados

```typescript
import { CacheTTL } from '@/lib/cache';

CacheTTL.LONG      // 1 hora   - Dados estáticos (roles, configurações)
CacheTTL.MEDIUM    // 5 minutos - Dados de usuário
CacheTTL.SHORT     // 1 minuto  - Dados voláteis (contagens)
CacheTTL.SESSION   // 15 minutos - Dados de sessão
CacheTTL.STATIC    // 7 dias    - Dados imutáveis (CEP)
CacheTTL.QUOTE     // 1 hora    - Cotações de frete
```

### Helpers de Domínio

```typescript
import {
  userCache,       // Dados do usuário
  roleCache,       // Roles do sistema
  configCache,     // Configurações
  collectorCache,  // Dados de coletor
  cepCache,        // Dados de CEP
  quoteCache,      // Cotações de frete
  faqCache,        // FAQs públicas
  pickupPointsCache // Pontos de coleta
} from '@/lib/cache';

// Exemplo: cache de usuário
const user = await userCache.get<User>(userId);
await userCache.set(userId, userData);
await userCache.invalidate(userId);

// Exemplo: cache-aside pattern
const data = await cacheGetOrSet(
  'key:value',
  () => fetchFromDatabase(),
  CacheTTL.LONG
);
```

### Endpoints com Cache

| Endpoint | Cache Key | TTL | Invalidação |
|----------|-----------|-----|-------------|
| `GET /api/cep/[cep]` | `cep:{cep}` | 7 dias | N/A (imutável) |
| `GET /api/faq` | `faq:{audience}:{category}` | 1 hora | Admin CRUD FAQ |
| `GET /api/auth/me` | `me:{userId}` | 5 min | PUT /account/me |
| `GET /api/pickup-points` | `pickup-points:{uf}:{cidade}` | 1 hora | Admin CRUD |
| Cotações Correios | `quote:{params}` | 1 hora | TTL expira |

### Padrão de Implementação

```typescript
import { configCache, CacheTTL } from '@/lib/cache';

export const GET = withApiHandler(async (context) => {
  const { searchParams } = new URL(context.req.url);
  const query = searchParams.get('q');

  // 1. Gerar cache key (só cacheia listagens sem busca)
  const shouldCache = !query;
  const cacheKey = shouldCache ? `items:list` : null;

  // 2. Verificar cache se aplicável
  if (cacheKey) {
    const cached = await configCache.get<Response>(cacheKey);
    if (cached) return { data: cached };
  }

  // 3. Buscar do banco
  const data = await fetchFromDatabase();

  // 4. Salvar no cache (fire and forget)
  if (cacheKey) {
    configCache.set(cacheKey, data).catch(() => {});
  }

  return { data };
});
```

### Invalidação de Cache

Sempre que dados são modificados (POST/PUT/PATCH/DELETE), invalidar o cache correspondente:

```typescript
import { faqCache, userCache, pickupPointsCache } from '@/lib/cache';

// Após criar/atualizar/deletar FAQ
faqCache.invalidateAll().catch(() => {});

// Após atualizar perfil do usuário
userCache.invalidate(userId).catch(() => {});

// Após modificar pontos de coleta
pickupPointsCache.invalidateAll().catch(() => {});
pickupPointsCache.invalidateByUf('SP').catch(() => {}); // Por UF específico
```

### Checklist para Cache em Novas Rotas

- [ ] Identificar se o endpoint é de leitura frequente
- [ ] Definir TTL apropriado (LONG para estáticos, MEDIUM para dinâmicos)
- [ ] Gerar cache key determinística (incluir parâmetros relevantes)
- [ ] NÃO cachear buscas textuais (muito variáveis)
- [ ] Implementar invalidação nas rotas de escrita correspondentes
- [ ] Usar pattern `fire and forget` para set/invalidate (não bloquear response)
- [ ] Testar comportamento com Redis indisponível (deve funcionar sem cache)

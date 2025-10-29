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

# Account Recipients API

Backend contract for managing recurring recipients via `/api/account/recipients` and related routes. All endpoints require an authenticated customer session (cookie `auth_token`). Responses follow the `{ data, error, meta }` envelope.

> **Infra note:** the API depends on the Prisma migration **`add_recipients`** being applied. The physical table lives at `public.recipients`; run `npx prisma migrate deploy` before using the endpoints in new environments.

## Data Model Snapshot

Each recipient record stores:

- Identification: `id`, `name`, `email`, `document`, `phone`, `notes`
- Address: `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`
- Flags: `isDefault`
- Metadata: `createdAt`, `updatedAt`

Names are normalized internally (spaces colapsed); `nameSearch` is used for case-insensitive queries. Documents are optional but, when present, duplicates are rejected (same user + document + CEP + name).

## Validation Rules

| Field | Notes |
| --- | --- |
| `name` | 2–120 chars, trimmed, spaces colapsed |
| `email` | Optional, trimmed + lowercased, RFC basic |
| `document` | Optional; digits only. Accepts CPF (11) or CNPJ (14) with checksum. |
| `phone` | Optional; normalized to E.164 (`+55...`). |
| `cep` | Required; 8 digits. |
| `uf` | Required; 2-letter uppercase. |
| `numero` | Required short string (e.g., `"123"` or `"S/N"`). |
| `notes` | Optional; max 280 chars. |

Validation errors surface with specific codes:

- `invalid_cpf`, `invalid_cnpj`
- `invalid_phone`
- `invalid_cep`
- `invalid_uf`
- `invalid_payload` for generic issues

## Rate Limiting

Mutating routes (`POST`, `PUT`, `DELETE`, `POST /make-default`) are limited to **10 requests/minute per IP**. Breaching the limit returns `429 rate_limit_exceeded`.

## Endpoints

### GET /api/account/recipients

Query params:

- `q` – optional search (name/email/document)
- `city` – filter by city (case-insensitive)
- `uf` – filter by UF (two letters)
- `page` – 1-based page index (default `1`)
- `pageSize` – items per page (default `20`, max `50`)

Response example:

```json
{
  "data": {
    "items": [
      {
        "id": "rec_01JAZ2Y5P5F3G1Q3N4FHYF6DJV",
        "name": "Maria Souza",
        "email": "maria@example.com",
        "document": "39053344705",
        "phone": "+5511999990000",
        "notes": "Interfonar no 12",
        "isDefault": true,
        "cep": "01001000",
        "logradouro": "Praça da Sé",
        "numero": "100",
        "complemento": null,
        "bairro": "Sé",
        "cidade": "São Paulo",
        "uf": "SP",
        "createdAt": "2025-01-10T12:00:00.000Z",
        "updatedAt": "2025-01-10T12:00:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  },
  "error": null,
  "meta": { "tags": ["account", "recipients"], "requestId": "..." }
}
```

### POST /api/account/recipients

Body example:

```json
{
  "name": "Maria Souza",
  "email": "maria@example.com",
  "document": "390.533.447-05",
  "phone": "(11) 99999-0000",
  "notes": "Interfonar no 12",
  "cep": "01001-000",
  "logradouro": "Praça da Sé",
  "numero": "100",
  "complemento": "Ap 12",
  "bairro": "Sé",
  "cidade": "São Paulo",
  "uf": "SP",
  "isDefault": true
}
```

Rules:

- Fields are normalized as described above.
- A user's first recipient is automatically marked as default.
- When `isDefault=true`, other recipients for the user lose the default flag atomically.
- Duplicate detection: same user + document (when provided) + CEP + normalized name → `409 duplicate_recipient`.

Successful response (`201 Created`) returns the created recipient (same shape as GET items).

### PUT /api/account/recipients/:id

Body allows partial updates of the same fields (excluding `id`/`userId`). When `isDefault=true`, the recipient becomes default and others are reset. Setting `isDefault=false` on the current default triggers promotion of the most recent remaining recipient.

### DELETE /api/account/recipients/:id

Deletes the recipient. If the removed record was default and other recipients exist, the most recent (`createdAt` desc) becomes the new default.

Response:

```json
{ "data": { "deleted": true }, "error": null, "meta": { ... } }
```

### POST /api/account/recipients/:id/make-default

Marks the recipient as default and clears the flag on others. Response mirrors the single-recipient payload.

### GET /api/recipients (Quote flow)

Utility endpoint used during quotation. Requires auth. Query param `cep` filters recipients by CEP (digits). Returns a simple array:

```json
[
  {
    "id": "rec_01JAZ2Y5P5F3G1Q3N4FHYF6DJV",
    "nome": "Maria Souza",
    "telefone": "+5511999990000",
    "email": "maria@example.com",
    "documento": "39053344705",
    "cep": "01001000",
    "logradouro": "Praça da Sé",
    "numero": "100",
    "complemento": null,
    "bairro": "Sé",
    "cidade": "São Paulo",
    "uf": "SP",
    "observacoes": "Interfonar no 12"
  }
]
```

### POST /api/recipients

Shortcut for the quotation flow. Accepts the same fields (Portuguese property names) and persists them through `/api/account/recipients`. Response returns the saved record in the simplified shape shown above.

## Error Reference

| Code | HTTP | Meaning |
| --- | --- | --- |
| `unauthorized` | 401 | Missing or invalid session. |
| `invalid_payload` | 400 | Malformed request body or unsupported combination. |
| `invalid_cpf` | 422 | Document provided but CPF checksum failed. |
| `invalid_cnpj` | 422 | Document provided but CNPJ checksum failed. |
| `invalid_phone` | 422 | Phone number cannot be normalized to `+55`. |
| `invalid_cep` | 422 | CEP must contain 8 digits. |
| `invalid_uf` | 422 | UF must be a two-letter code. |
| `duplicate_recipient` | 409 | Recipient already exists for the user (document + CEP + name). |
| `recipient_not_found` | 404 | Recipient not found or does not belong to the user. |
| `rate_limit_exceeded` | 429 | Write limit exceeded (10 req/min). |

Unhandled errors return `500 internal_error`.

## Notes

- Logs omit sensitive data (documents/phones only logged when necessary).
- Phone numbers are stored/returned in E.164 format.
- Use `CARD_VAULT_KEY`/etc. from `.env` as usual; no additional env vars required.

# Account Cards API

Back-end contract for managing customer payment cards under `/api/account/cards`.\
All routes are authenticated and expect the session cookie `auth_token`.\
Responses follow the standard envelope `{ data, error, meta }`.

## Environment Requirements

| Variable | Description |
| --- | --- |
| `APP_ENV` | `development`, `test`, or `production`. Controls PAN storage behaviour. |
| `CARD_VAULT_KEY` | Base64 encoded 32-byte key for AES-256-GCM encryption. Required for create/update flows. |
| `CARD_DEV_AUTH_TOKEN` | **Dev only.** Shared secret required by `POST /:id/pan`. Leave unset in production. |

Generate a compatible vault key:

```bash
openssl rand -base64 32
```

If `CARD_VAULT_KEY` is missing or invalid, creation/update attempts return `422 vault_not_configured`.

## Rate Limiting

Write operations (POST/PUT/DELETE/make-default) are limited to **10 requests per minute per IP**.\
Breaching the limit yields `429 rate_limit_exceeded`.

## Data Model Snapshot

Stored fields per card:\
`brand`, `holderName`, `last4`, `expMonth`, `expYear`, `isDefault`, `billingAddressId`, `fingerprint`, `vaultToken`, `createdAt`, `updatedAt`, optional `panCipher` (non-production only).

`fingerprint = BIN-last4-expYear-expMonth`, unique per user.

CVV is never persisted and the full PAN is only encrypted when `APP_ENV !== "production"`.

## Endpoints

### GET /api/account/cards

Query params:

- `page` (default `1`)
- `pageSize` (default `20`, max `50`)

Response:

```json
{
  "data": {
    "items": [
      {
        "id": "card_cuid",
        "brand": "VISA",
        "holderName": "JOAO SILVA",
        "last4": "4242",
        "expMonth": 9,
        "expYear": 2030,
        "isDefault": true,
        "billingAddressId": "addr_uuid",
        "createdAt": "2025-01-12T15:04:05.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "error": null,
  "meta": { "...": "..." }
}
```

### POST /api/account/cards

Body:

```json
{
  "number": "4242 4242 4242 4242",
  "holderName": "João da Silva",
  "expMonth": 9,
  "expYear": 2030,
  "cvv": "123",
  "isDefault": true,
  "billingAddressId": "existing-address-id",
  "billingAddress": {
    "cep": "01001000",
    "logradouro": "Praça da Sé",
    "numero": "100",
    "bairro": "Sé",
    "cidade": "São Paulo",
    "uf": "SP"
  }
}
```

Também é aceito o formato abreviado:

```json
{
  "number": "4242 4242 4242 4242",
  "holderName": "João da Silva",
  "expiry": "12/30"
}
```

Rules:

- `number` runs full normalization (spaces, hyphens stripped) + Luhn check + 13–19 digits.
- `brand` auto-detected from BIN; falls back to `OTHER`.
- `holderName` trimmed, uppercased, restricted to letters, spaces, `.` and `-`.
- Expiration pode ser enviada como `expMonth` + `expYear` (strings ou números) ou `expiry` (`MM/YY` ou `MM/YYYY`).
- `expMonth` é normalizado para inteiro (1–12) e `expYear` para quatro dígitos (anos 2000+). Valores fora do intervalo atual -1 / +15 retornam `invalid_exp_year`.
- Cartões são considerados válidos até o último dia do mês informado; vencidos retornam `card_expired`.
- If both `billingAddressId` and `billingAddress` are provided, request is rejected (`400 invalid_payload`).
- First card becomes default automatically. Setting `isDefault: true` promotes the card and demotes the others atomically.
- Duplicate fingerprint (`BIN-last4-exp`) yields `409 duplicate_card`.

Successful response (`201 Created`) mirrors GET items payload for the created card.

### PUT /api/account/cards/:id

Allows partial updates of:

- `holderName`
- `expMonth` + `expYear` (must be provided together)
- `billingAddressId` (can be `null`)
- `isDefault`

Body example:

```json
{
  "holderName": "João A. Silva",
  "expMonth": 12,
  "expYear": 2031,
  "isDefault": true
}
```

Behaviour:

- Expiration update regenerates the fingerprint; conflicts raise `409 duplicate_card`.
- Setting `isDefault: true` demotes all other cards in the same transaction.
- Setting `isDefault: false` promotes the most recently created remaining card to keep a default on file.
- `billingAddressId` must belong to the same user; otherwise `403 forbidden`.
- Invalid payloads or empty body return `400 invalid_payload`.

Response (`200 OK`): updated card payload.

### DELETE /api/account/cards/:id

Removes the card belonging to the authenticated user.\
When deleting the default card and other cards exist, the most recently created one becomes the new default.

Response (`200 OK`):

```json
{ "data": { "deleted": true }, ... }
```

### POST /api/account/cards/:id/make-default

Sets the targeted card as default and clears the flag for the other cards.\
Response mirrors the single-card payload.

### POST /api/account/cards/:id/pan (Dev Only)

- Available only when `APP_ENV !== "production"`.
- Requires header `X-Dev-Auth` matching `CARD_DEV_AUTH_TOKEN`.
- Decrypts `panCipher` and returns the clear PAN for local simulations.

Response:

```json
{
  "data": { "pan": "4242424242424242" },
  "error": null,
  "meta": { "...": "..." }
}
```

If `panCipher` is unavailable or the record was created in production mode, returns `404 pan_unavailable`.

## Error Reference

| Code | HTTP | Meaning |
| --- | --- | --- |
| `unauthorized` | 401 | Session cookie missing or invalid. |
| `forbidden` | 403 | Resource not owned by user or dev secret missing/invalid. |
| `invalid_payload` | 400 | Malformed JSON or validation failure (including holder name). |
| `invalid_number` | 422 | PAN failed normalization/Luhn checks. |
| `invalid_cvv` | 422 | CVV format invalid (3–4 digits expected). |
| `invalid_exp_month` | 422 | Month out of range (01–12) or malformed. |
| `invalid_exp_year` | 422 | Year out of accepted range (current year −1 to current year +15). |
| `card_expired` | 422 | Expiration already passed for the month/year combination. |
| `duplicate_card` | 409 | Fingerprint already registered for the user. |
| `vault_not_configured` | 422 | `CARD_VAULT_KEY` absent or not 32-byte base64. |
| `rate_limit_exceeded` | 429 | Write request limit exceeded. |
| `not_found` | 404 | Card or billing address not found / not owned by user. |
| `pan_unavailable` | 404 | PAN not stored (production cards). |

Any unhandled failure returns `500 internal_error`.

## Operational Guidelines

- Never log PAN, CVV, fingerprints, or card numbers. Only log brand, last4, and IDs if required.
- Set `CARD_VAULT_KEY` differently per environment. Rotate keys if compromised.
- In production, integrate a gateway to provide `vaultToken` and bypass local PAN storage (keep `APP_ENV=production`).
- Ensure TLS termination before requests reach these endpoints.

## CURL Examples

```bash
# List cards
curl -b "auth_token=..." http://localhost:3000/api/account/cards

# Create card
curl -X POST \
  -H "Content-Type: application/json" \
  -b "auth_token=..." \
  -d '{"number":"4242 4242 4242 4242","holderName":"João Silva","expMonth":9,"expYear":2030,"cvv":"123"}' \
  http://localhost:3000/api/account/cards

# Make default
curl -X POST -b "auth_token=..." http://localhost:3000/api/account/cards/<cardId>/make-default

# DEV only: retrieve PAN
curl -X POST \
  -H "X-Dev-Auth: $CARD_DEV_AUTH_TOKEN" \
  -b "auth_token=..." \
  http://localhost:3000/api/account/cards/<cardId>/pan
```

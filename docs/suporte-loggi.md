# Chamado de Suporte — Loggi

**Assunto:** Erro HTTP 500 no endpoint de geração de etiquetas (`/v1/companies/{companyId}/labels`)

**Prioridade:** Alta

---

## Dados da Conta

- **Company ID:** 2152308
- **Client ID (Service Account):** smb-servlog-logistica-service-account
- **Ambiente:** Produção (`https://api.loggi.com`)

---

## Descrição do Problema

O endpoint de geração de etiquetas retorna **HTTP 500 (Internal Server Error)** para todos os `loggiKeys`, inclusive shipments criados há vários dias. A autenticação OAuth2 funciona normalmente e a criação de shipments via `/v1/companies/{companyId}/async-shipments` também funciona corretamente.

Apenas o endpoint de **labels** apresenta falha.

---

## Reprodução

### 1. Autenticação (funciona normalmente)

```
POST https://api.loggi.com/v2/oauth2/token
Content-Type: application/json

{
  "client_id": "smb-servlog-logistica-service-account",
  "client_secret": "***"
}
```

**Resposta:** 200 OK — `idToken` retornado com sucesso.

### 2. Criação de Shipment (funciona normalmente)

```
POST https://api.loggi.com/v1/companies/2152308/async-shipments
Authorization: Bearer {idToken}
Content-Type: application/json

{
  "externalServiceId": "DLVR-DROF-DOOR-STAN-01",
  "shipFrom": { ... },
  "shipTo": { ... },
  "packages": [{ ... }]
}
```

**Resposta:** 200 OK — `loggiKey` e `trackingCode` retornados com sucesso.

### 3. Geração de Etiqueta (ERRO)

```
POST https://api.loggi.com/v1/companies/2152308/labels
Authorization: Bearer {idToken}
Content-Type: application/json

{
  "loggiKeys": ["V3O5JPLG3JOX7ASORC5DLTGJOH"],
  "responseType": "LABEL_RESPONSE_TYPE_BASE_64",
  "format": "LABEL_FORMAT_PDF",
  "layout": "LABEL_LAYOUT_A4"
}
```

**Resposta:** 500 Internal Server Error

```json
{
  "code": 2,
  "message": "",
  "details": []
}
```

Também testamos com `LABEL_RESPONSE_TYPE_URL` e sem os campos `format`/`layout` — mesmo resultado (500).

### loggiKeys testadas (todas retornam 500)

| loggiKey | Data de criação | trackingCode |
|----------|----------------|--------------|
| V3O5JPLG3JOX7ASORC5DLTGJOH | 2026-03-05 | 5DLTGJOH |
| EB5WWPLG3JOXYIHDPXOVQFFXCG | 2026-03-05 | — |
| AKZLTDLG3JOXVDFQKJF6AWO5J3 | 2026-02-24 | — |

---

## Perguntas

1. Existe alguma configuração de contrato ou permissão necessária para habilitar a geração de etiquetas via API para nossa conta?
2. O endpoint `/v1/companies/{companyId}/labels` está operacional no momento?
3. Há algum requisito adicional para que a etiqueta fique disponível após a criação do shipment via `async-shipments`?

---

## Impacto

Não conseguimos gerar etiquetas de envio para nossos clientes via integração. Os shipments são criados com sucesso, mas a etiqueta (PDF) não pode ser obtida pela API, bloqueando o fluxo de impressão e despacho.

# Chamado de Suporte — J&T Express

**Assunto:** API Account não reconhecida no endpoint de cotação de frete

**Prioridade:** Alta

---

## Dados da Conta

- **Customer Code:** *(informado nas credenciais)*
- **API Account:** *(informado nas credenciais — campo `apiAccount`)*
- **Ambiente:** Sandbox / Homologação

---

## Descrição do Problema

A autenticação com a J&T funciona corretamente — conseguimos gerar os digests (body digest e header digest) e validar as credenciais. Porém, o **endpoint de cotação de frete** rejeita a chamada com o erro:

```
Código: 145003010
Mensagem: "API account does not exist"
```

Este erro ocorre em **todos os endpoints** que tentamos além da validação de autenticação. Apenas a geração e validação de assinaturas funciona — nenhuma operação real (cotação, criação de pedido, etc.) é aceita.

---

## Reprodução

### 1. Autenticação / Assinaturas (funciona)

A geração de assinaturas está correta — confirmamos que:
- Password hash: `MD5(password + "jadada236t2")` → uppercase
- Body digest: `Base64(MD5(customerCode + passwordHash + privateKey))`
- Header digest: `Base64(MD5(jsonPayload + privateKey))`

As assinaturas são geradas sem erro e o formato é aceito pela API (o erro retornado é sobre a `apiAccount`, não sobre assinatura inválida).

### 2. Chamada de Cotação (ERRO)

```
POST https://demogw.jtjms-br.com/webopenplatformapi/api/logistics/cost/query
Content-Type: application/x-www-form-urlencoded

bizContent={
  "customerCode": "***",
  "digest": "***",
  "destinationZipCode": "80030000",
  "productTypeCode": "EZ",
  "weight": "5"
}

Headers:
  digest: {headerDigest}
  apiAccount: {apiAccount}
  timestamp: {timestamp}
```

**Resposta:**

```json
{
  "code": "145003010",
  "msg": "API account does not exist",
  "data": null
}
```

### 3. Criação de Pedido (ERRO — mesmo erro)

```
POST https://jtapi-uat.jtjms-br.com/webopenplatformapi/api/order/addOrder
Content-Type: application/x-www-form-urlencoded

bizContent={...payload de criação de pedido...}

Headers:
  digest: {headerDigest}
  apiAccount: {apiAccount}
  timestamp: {timestamp}
```

**Resposta:** Mesmo erro `145003010 - API account does not exist`.

---

## Perguntas

1. A `apiAccount` fornecida nas credenciais de homologação está ativa e tem permissão para acessar os endpoints da API?
2. É necessário alguma habilitação, ativação ou contrato adicional para que a conta funcione nos endpoints de cotação e criação de pedido?
3. As URLs base corretas para o ambiente de homologação são:
   - **Pedidos:** `https://jtapi-uat.jtjms-br.com`
   - **Cotação:** `https://demogw.jtjms-br.com`

   Estão corretas?
4. Existe algum prazo de ativação após a criação da conta de homologação?

---

## Impacto

Sem a `apiAccount` funcionando, não conseguimos realizar nenhuma operação via API (cotação, criação de pedido, impressão de etiqueta, rastreamento). A integração está toda implementada do nosso lado, mas bloqueada por este erro de autenticação de conta.

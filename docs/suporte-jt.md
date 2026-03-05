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

A autenticação com a J&T funciona corretamente — conseguimos gerar os digests (body digest e header digest) e a API aceita as credenciais em outros endpoints. Porém, o **endpoint de cotação de frete** rejeita a chamada com o erro:

```
Código: 145003010
Mensagem: "API account does not exist"
```

Outros endpoints (como criação de pedido) funcionam normalmente com as mesmas credenciais.

---

## Reprodução

### 1. Chamada de Cotação (ERRO)

```
POST https://cotacao-api-url/webopenplatformapi/api/logistics/cost/query
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

### 2. Criação de Pedido (funciona normalmente)

Com as mesmas credenciais (`customerCode`, `apiAccount`, `password`, `privateKey`), a criação de pedidos via endpoint padrão funciona sem problemas. O `billCode` é retornado corretamente.

### 3. Teste de Assinaturas (funciona)

A geração de assinaturas está correta — confirmamos que:
- Password hash: `MD5(password + "jadada236t2")` → uppercase
- Body digest: `Base64(MD5(customerCode + passwordHash + privateKey))`
- Header digest: `Base64(MD5(jsonPayload + privateKey))`

---

## Perguntas

1. A `apiAccount` fornecida nas credenciais de homologação tem permissão para acessar o endpoint de cotação de frete (`/logistics/cost/query`)?
2. É necessário alguma habilitação ou contrato adicional para utilizar o endpoint de cotação via API?
3. As URLs base para cotação são diferentes das URLs base para criação de pedidos? Estamos utilizando:
   - **Pedidos (sandbox):** `https://jtapi-uat.jtjms-br.com`
   - **Cotação (sandbox):** `https://demogw.jtjms-br.com`
4. Existe algum endpoint alternativo para cotação de frete no sandbox?

---

## Observações Adicionais

- As credenciais de homologação retornam custo **R$ 0,00** e prazo **0 dias** nas cotações que eventualmente passam. Entendemos que isso é comportamento esperado em ambiente de homologação. Gostaríamos de confirmação.
- Estamos prontos para migrar para produção assim que as credenciais de produção estiverem disponíveis e o endpoint de cotação estiver acessível.

---

## Impacto

Sem o endpoint de cotação funcionando, não conseguimos exibir preços e prazos da J&T para nossos clientes no momento da compra. A integração de criação de pedidos e rastreamento já está implementada e funcional.

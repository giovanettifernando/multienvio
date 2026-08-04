# Guia de teste manual — migração para o Asaas

**Estado:** 16 tasks implementadas, 29 commits locais, **nada pushado**.
Ambiente: sandbox do Asaas (dinheiro de mentira). Banco de desenvolvimento.

---

## Antes de começar

```bash
cd "/home/fernando-giovanetti/Área de trabalho/envio_legal"
pnpm dev
```

Em outro terminal, se quiser acompanhar os pagamentos chegando:

```bash
pnpm workers
```

> O `workers` é o processo que consome os webhooks e roda o monitor de pendências.
> Sem ele, um pagamento confirmado no Asaas não reflete no app automaticamente.
> Ele precisa de Redis rodando.

**Login de teste:** `user@enviolegal.com` — **Admin:** `admin@enviolegal.com`
(as senhas são as que você definiu no seed)

---

## Cartão de teste do Asaas

| Campo | Valor |
|---|---|
| Número | `5162 3062 1937 8829` |
| Validade | qualquer data futura (ex.: 12/2030) |
| CVV | `318` |
| CEP | `89223-005` |
| Número do endereço | `277` |

> **Novidade:** o Asaas exige CEP e número do endereço do titular. O gateway
> anterior não pedia — por isso esses campos apareceram nos formulários.

---

## Roteiro de teste

### 1. Recarga de carteira — PIX
Carteira → adicionar saldo → **PIX**.
**Esperado:** QR Code aparece na tela, com botão de copiar o código.
**O que provar:** o QR Code é real (dá pra escanear); o valor confere.

### 2. Recarga de carteira — Boleto
Carteira → adicionar saldo → **Boleto**.
**Esperado:** antes de escolher, você já vê o aviso *"compensação em até 3 dias
úteis"*. Depois de gerar: linha digitável com botão copiar, botão que abre o PDF,
data de vencimento visível.
**O que provar:** o PDF abre de verdade; o saldo **não** é creditado na hora
(é assim que tem que ser — só credita após a compensação).

### 3. Recarga de carteira — Cartão
Carteira → adicionar saldo → **Cartão** → dados de teste acima.
**Esperado:** aprovação em segundos e saldo creditado.
**O que provar:** o valor certo entrou na carteira.

### 4. Checkout do carrinho
Monte um carrinho e pague com cada um dos três meios.
**Esperado:** PIX e cartão liberam o envio; boleto deixa o pedido aguardando.

### 5. Cadastrar cartão em Minha Conta
Minha Conta → Cartões → adicionar.
**Esperado:** cartão salvo com bandeira e últimos 4 dígitos.
> Este fluxo estava 100% quebrado e foi corrigido no último commit — vale testar
> com atenção.

### 6. Link público de pagamento pelo destinatário
Gere um envio com pagamento pelo destinatário e **abra o link numa janela
anônima** (é assim que o destinatário vê).
**Esperado:** paga com PIX, boleto ou cartão sem precisar de login.
> A tokenização de cartão aqui usa uma rota pública nova, criada especificamente
> para este caso. Testar em janela anônima é importante: era exatamente aí que
> estava o bug de cobrar na conta errada.

### 7. Painel administrativo
`/admin/asaas` (logado como admin).
**Esperado:** ver o estado da configuração, trocar chave e ambiente
(Sandbox/Produção), configurar o token de webhook.
**O que provar:** salvar uma chave passa a valer **na hora** (não depois de 5 min).

### 8. Confirmar um pagamento de verdade (o teste definitivo)
No painel do Asaas (`sandbox.asaas.com`), encontre uma cobrança PIX ou boleto que
você gerou e **simule o pagamento**.
**Esperado:** com o `pnpm workers` rodando, em segundos o pedido sai de "aguardando"
e o serviço é liberado.
**O que isso prova:** o ciclo inteiro — cobrança → pagamento → webhook → liberação.

---

## O que ainda NÃO está pronto (esperado, não é bug)

- **O código do Pagar.me ainda está no projeto** (Task 17 remove). Rotas antigas
  como `/api/payments/pagarme/*` ainda existem, mas o gateway está desativado no
  banco — se alguma tela chamar por engano, dá erro de configuração. Nada no
  fluxo novo usa essas rotas.
- **Webhook em ambiente local** só funciona se a sua máquina estiver acessível pela
  internet (ngrok ou similar) e a URL estiver cadastrada no painel do Asaas. Sem
  isso, o teste 8 depende do **monitor de pendências**, que varre a cada 2 minutos
  e alcança o mesmo resultado — só demora um pouco mais.
- **Duas revisões pendentes:** o fix dos 2 problemas críticos da Task 15 e o painel
  admin (Task 16). O código está implementado e com `tsc` limpo; falta a auditoria
  independente.

---

## Se algo quebrar

Anote **em qual tela**, **o que você clicou** e **a mensagem de erro** (e o que
aparece no terminal do `pnpm dev`). Com isso dá pra corrigir cirurgicamente, sem
gastar cota adivinhando.

---

## Taxas do Asaas (medidas na sua conta)

| Modalidade | Taxa |
|---|---|
| Boleto | R$ 0,99 fixo |
| Cartão à vista | 1,99% + R$ 0,49 |
| Cartão parcelado | 2,16% + R$ 0,49 **por parcela** |

Sem mensalidade, sem adesão. Confirme no painel antes de ir para produção.

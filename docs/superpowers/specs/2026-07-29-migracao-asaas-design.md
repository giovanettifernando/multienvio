# Migração do gateway de pagamento para o Asaas

**Data:** 29/07/2026
**Status:** desenho aprovado, aguardando implementação

---

## 1. Resumo executivo

O sistema vai trocar o gateway de pagamento **Pagar.me pelo Asaas**. A integração anterior nunca chegou a funcionar por um problema de credenciais do lado do provedor. O Asaas já foi testado de ponta a ponta e **funciona**.

Escopo: PIX, cartão de crédito e cartões salvos. Boleto fica de fora por ora.

---

## 2. Por que trocar

O projeto passou por duas migrações seguidas: MercadoPago → Pagar.me → Asaas.

A integração com o Pagar.me foi escrita por completo (30 commits), mas **nenhuma chamada à API deles jamais foi autorizada**. Todas as tentativas retornaram o mesmo erro:

```
HTTP 401 — "Authorization has been denied for this request."
```

O que foi verificado antes de desistir:

- As duas chaves (pública e secreta) testadas de forma independente
- Três endpoints diferentes (`/tokens`, `/orders`, `/customers`)
- Autenticação montada de todas as formas (Basic Auth, header manual, chave via query string)
- Formato das chaves conferido: padrão correto, sem espaços ou truncamento

Conclusão: o problema estava no provisionamento da conta no Pagar.me, não no nosso código. Como o erro era genérico e igual para tudo, não havia diagnóstico possível do nosso lado.

**Nada disso chegou a produção.** O código do Pagar.me nunca foi publicado no servidor, então a troca não afeta nenhum cliente.

---

## 3. Validação do Asaas — o que já foi testado

Testes executados na conta de sandbox real, via chamadas diretas à API:

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | Autenticação | ✅ autorizado |
| 2 | Criar cliente | ✅ cliente criado |
| 3 | Gerar cobrança PIX | ✅ cobrança pendente criada |
| 4 | Obter QR Code do PIX | ✅ código copia-e-cola + imagem |
| 5 | Salvar cartão (tokenização) | ✅ token + bandeira + últimos 4 dígitos |
| 6 | Cobrar cartão salvo | ✅ **aprovado na hora** |
| 7 | Parcelamento em 3x | ✅ **aprovado na hora** |

Dois ganhos técnicos relevantes:

- **Acabou o problema de CORS.** No Pagar.me, salvar um cartão exigia uma chamada do navegador que o próprio navegador bloqueava, obrigando a criar um intermediário no servidor. No Asaas isso acontece direto no servidor.
- **Mensagens de erro claras.** Quando algo está errado, o Asaas diz exatamente o quê (ex.: "o celular informado é inválido"). Isso reduz muito o tempo de diagnóstico.

---

## 4. Custos

O Asaas **não tem mensalidade nem taxa de adesão**. Cobra por transação.

Taxas medidas na prática, comparando valor bruto e líquido:

| Modalidade | Valor | Líquido | Taxa | Fórmula |
|---|---|---|---|---|
| Cartão à vista | R$ 149,90 | R$ 146,43 | R$ 3,47 | 1,99% + R$ 0,49 |
| Cartão 3x (por parcela) | R$ 100,00 | R$ 97,35 | R$ 2,65 | 2,16% + R$ 0,49 |

**Atenção ao parcelamento:** o valor fixo de R$ 0,49 é cobrado *por parcela*. Uma venda em 12x paga esse fixo doze vezes. Vale considerar isso ao definir em quantas parcelas o cliente pode dividir.

O ambiente de testes (sandbox) é gratuito e ilimitado. As taxas acima são as do sandbox — devem ser confirmadas no painel (Configurações → Taxas) antes de ir para produção, e costumam ser negociáveis conforme o volume.

---

## 5. O que será feito

### 5.1 Estrutura

Criar o módulo `platform/integrations/asaas/` e **remover** `platform/integrations/pagarme/`.

A estrutura do banco de dados **não muda**. As tabelas de pagamento já foram feitas de forma genérica, sem amarração a um provedor específico — só o registro do gateway passa a apontar para o Asaas. Isso é o que permite trocar de provedor sem refazer o histórico de transações.

### 5.2 Três pontos de atenção na conversão

**Reais x centavos.** O sistema guarda valores em centavos (`4990`); o Asaas trabalha em reais (`49,90`). A conversão fica isolada na borda da integração, para que nenhum número quebrado circule pelo sistema. Arredondamento em dinheiro é erro que só aparece no fechamento contábil.

**Data de vencimento.** O Asaas trata toda cobrança como tendo um vencimento. Para compras à vista, a data enviada é a do próprio dia.

**Cartão salvo é vinculado ao cliente.** No Asaas, um cartão salvo só pode ser cobrado para o mesmo cliente que o cadastrou. O cofre de cartões passa a guardar esse vínculo.

### 5.3 Quando o pedido é liberado

O Asaas informa dois momentos distintos no cartão:

- **Confirmado** — a compra foi aprovada (acontece em segundos)
- **Recebido** — o dinheiro caiu na conta (acontece em cerca de 30 dias)

**Decisão: o serviço é liberado na confirmação.** É o padrão do mercado. Esperar o recebimento significaria o cliente pagar hoje e receber a etiqueta só no mês seguinte. No PIX os dois momentos são simultâneos, então não há diferença.

### 5.4 Fluxos afetados

Três fluxos usam pagamento e serão convertidos:

1. **Recarga de carteira** — usuário adiciona saldo
2. **Checkout do carrinho** — pagamento do envio
3. **Pagamento pelo destinatário** — link público onde quem recebe paga o frete

Além deles: estorno, painel administrativo, monitoramento de PIX pendente e recebimento de notificações do gateway.

### 5.5 Notificações automáticas (webhooks)

O Asaas avisa o sistema quando uma cobrança muda de estado (confirmada, recebida, estornada, vencida, contestada). O sistema já tem a estrutura para receber e reprocessar esses avisos com segurança contra duplicidade — ela será reaproveitada, apenas apontando para o formato do Asaas.

### 5.6 Estornos

O Asaas permite estorno total ou parcial, tanto em PIX quanto em cartão. A funcionalidade de estorno que já existe no painel continua funcionando.

---

## 6. Riscos e como são tratados

| Risco | Tratamento |
|---|---|
| Erro de arredondamento em valores | Conversão isolada e centralizada em um único ponto |
| Cobrança duplicada por reenvio de notificação | Controle de duplicidade já existente no banco |
| Diferença de comportamento entre sandbox e produção | Homologar cada fluxo no sandbox antes de publicar |
| Chave de produção inválida (repetir o caso Pagar.me) | Validar a chave contra a API **antes** de publicar |

---

## 7. Situação do código anterior

Existem 30 commits da integração com o Pagar.me que nunca foram publicados no servidor. Eles serão removidos pela nova implementação, mas **permanecem no histórico do projeto** caso seja necessário consultá-los.

O servidor de produção segue rodando a versão anterior, sem nenhuma das duas migrações.

---

## 8. Próximo passo

Escrever o plano de implementação detalhado, com a ordem das tarefas e os testes de cada etapa.

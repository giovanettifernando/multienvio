# Migração do gateway de pagamento para o Asaas — Entrega

**Data:** 05/08/2026
**Situação:** código completo e no repositório. **Não deployado. Não homologado.**

---

## 1. O que foi feito

O sistema de pagamentos foi migrado do **Pagar.me** para o **Asaas**, cobrindo
PIX, cartão de crédito, cartões salvos e **boleto** (que é novidade).

A troca aconteceu porque a integração com o Pagar.me nunca chegou a funcionar:
todas as chamadas à API deles retornavam erro de autorização, com credenciais
que jamais autenticaram. O código estava pronto, mas nunca havia sido publicado
— então a troca não afetou nenhum cliente.

O código do Pagar.me foi removido do projeto (2.511 linhas).

---

## 2. O que está pronto e provado

| Fluxo | Estado |
|---|---|
| Recarga de carteira — cartão | ✅ testado, aprovação e crédito confirmados no banco |
| Recarga de carteira — boleto | ✅ geração testada (PDF e linha digitável) |
| Recarga de carteira — PIX | ✅ geração testada (QR Code) |
| Checkout do carrinho | ✅ testado, envios criados |
| Painel administrativo | ✅ testado, credenciais gravadas criptografadas |
| Remoção do Pagar.me | ✅ concluída, sem erros de tipo |

---

## 3. ⚠️ O que NÃO foi testado — leia antes de deployar

### 3.1 O ciclo de confirmação assíncrona nunca rodou

Nenhuma cobrança foi confirmada no painel do Asaas. No banco não existe uma
única transação com status "pago".

Isso significa que a cadeia **pagamento confirmado → sistema descobre →
carteira creditada / envio liberado** nunca foi exercitada de ponta a ponta.

**Por que importa:** o cartão aprova na hora, então funciona. Mas **PIX e boleto
dependem inteiramente dessa cadeia** — o cliente paga depois, e o sistema
precisa descobrir sozinho. Se algo estiver errado aí, o cliente paga e não
recebe o serviço.

**Como testar (15 minutos):**
1. Gerar uma cobrança PIX ou boleto pelo app
2. No painel do sandbox (`sandbox.asaas.com`), achar a cobrança e **simular o
   recebimento**
3. Com o processo de workers rodando, confirmar que em até 2 minutos a
   transação muda de estado e o saldo/envio é liberado

> Nada disso movimenta dinheiro real — a conta de sandbox é isolada.

### 3.2 A chave de produção nunca foi validada

**Este é o ponto mais importante do documento.**

Foi exatamente isso que derrubou o Pagar.me: a integração inteira foi escrita,
revisada e dada como pronta, e a chave nunca autenticou. Descobrimos tarde.

Antes de qualquer deploy em produção, rode:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "access_token: CHAVE_DE_PRODUCAO_AQUI" \
  "https://api.asaas.com/v3/customers?limit=1"
```

- **`200`** → a chave é válida, pode seguir
- **qualquer outra coisa** → **não deploye**, resolva antes

O comando é seguro: apenas lê, não cria nem cobra nada.

### 3.3 Duas revisões de código ficaram pendentes

O painel administrativo e a última correção de interface não passaram pela
auditoria independente que as demais etapas receberam. O código está com
verificação de tipos limpa e foi testado manualmente, mas sem revisão formal.

---

## 4. O que é preciso para publicar

### 4.1 Acessos que ainda não temos

**Chave de produção do Asaas.** Sandbox e produção são **contas separadas** no
Asaas, com logins diferentes:

| Ambiente | Endereço | Formato da chave |
|---|---|---|
| Testes | `sandbox.asaas.com` | `$aact_hmlg_...` |
| Produção | `www.asaas.com` | `$aact_prod_...` |

A conta de produção pertence ao cliente (é nela que o dinheiro cai). A chave
fica em **Configurações → Integrações → Chave de API**.

> **Atenção ao prazo:** a conta de produção do Asaas costuma exigir aprovação
> (documentos da empresa, dados bancários). Se ainda não estiver aprovada, a
> chave existe mas as cobranças falham. Vale confirmar o status **antes** de
> agendar o deploy, não no dia.

### 4.2 Configuração no servidor

O arquivo de variáveis de ambiente **não vai junto com o código**. No servidor
precisam existir:

- `ASAAS_API_KEY` — a chave da conta
- `ASAAS_WEBHOOK_TOKEN` — senha que valida os avisos do Asaas (entre 32 e 255
  caracteres, definida por nós)

### 4.3 Banco de dados

Rodar a migration. Ela adiciona dois campos e não apaga dados.

### 4.4 Processo de workers

O comando que roda os workers **precisa estar ativo**. É ele que recebe a
confirmação de pagamento e reflete no sistema. **Sem ele, PIX e boleto nunca
completam** — a cobrança é gerada, o cliente paga, e nada acontece.

### 4.5 Webhook no painel do Asaas

Cadastrar a URL pública do sistema apontando para `/api/webhooks/asaas`,
informando o mesmo token do item 4.2.

Sem isso, a confirmação depende só da varredura automática que roda a cada 2
minutos — funciona, mas com atraso.

---

## 5. Ordem recomendada

1. **Deployar com a chave de sandbox** — o cliente testa numa URL real, sem
   risco de movimentar dinheiro
2. **Cliente aprova**
3. **Validar a chave de produção** com o comando do item 3.2
4. **Trocar chave e ambiente pelo painel** `/admin/asaas` — tem seletor
   Sandbox/Produção que ajusta o endereço sozinho, sem precisar de novo deploy

---

## 6. Custos do Asaas

Taxas medidas na prática, comparando valor bruto e líquido:

| Modalidade | Taxa |
|---|---|
| Boleto | R$ 0,99 fixo |
| Cartão à vista | 1,99% + R$ 0,49 |
| Cartão parcelado | 2,16% + R$ 0,49 **por parcela** |

Sem mensalidade e sem adesão. O boleto é a forma mais barata de receber — numa
venda de R$ 500, custa R$ 0,99 contra R$ 10,44 do cartão.

**Atenção ao parcelamento:** o valor fixo é cobrado *por parcela*. Uma venda em
12x paga esse fixo doze vezes.

> Valores do ambiente de teste. Confirmar no painel (Configurações → Taxas)
> antes de produção — são negociáveis conforme o volume.

---

## 7. Problemas antigos corrigidos de passagem

Durante os testes apareceram falhas que **já existiam antes** da migração:

- O processo de workers **nunca conseguiu subir** nesta base: uma dependência
  usada por quatro comandos nunca foi declarada, e o carregamento das variáveis
  de ambiente acontecia tarde demais. Isso significa que rastreamento de
  encomendas, envio de e-mails, geração de PDF e reconciliação também estavam
  parados em ambiente local.
- O painel antigo de gateway gravava o token de webhook numa coluna que o
  sistema nunca lia — configurar por ali nunca funcionou.
- A tela de finalizar envio não exibia o cabeçalho do resumo e, com ele, o
  interruptor "Destinatário paga o frete" ficava inacessível.
- O fluxo de envio pago e o link público de pagamento criavam o envio **sem
  verificar se houve pagamento**. O link público não tinha autenticação alguma.

Os dois últimos eram falhas de segurança com impacto financeiro direto.

---

## 8. Onde está a documentação

| Documento | Conteúdo |
|---|---|
| `docs/superpowers/specs/2026-07-29-migracao-asaas-design.md` | Decisões e justificativas |
| `docs/superpowers/plans/2026-07-29-migracao-asaas.md` | Plano técnico detalhado |
| `docs/superpowers/TESTE-MANUAL-ASAAS.md` | Roteiro de teste passo a passo |

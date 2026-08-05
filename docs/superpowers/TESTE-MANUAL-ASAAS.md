# Guia de teste manual — migração para o Asaas

**Estado:** 16 tasks implementadas, 29 commits locais, **nada pushado**.
Ambiente: sandbox do Asaas (dinheiro de mentira). Banco de desenvolvimento.

---

## Antes de começar

**Terminal 1 — o app:**

```bash
cd "/home/fernando-giovanetti/Área de trabalho/envio_legal"
pnpm dev
```

**Terminal 2 — os workers** (quem reflete o pagamento confirmado no app):

```bash
cd "/home/fernando-giovanetti/Área de trabalho/envio_legal"
pnpm workers
```

Você deve ver, no fim da saída dos workers:

```
[WORKERS] 15 workers started:
  - payment.pix-monitor (concurrency: 1)
  - webhook.asaas (concurrency: 5)
```

Esses dois são os que importam aqui: `webhook.asaas` recebe a confirmação de
pagamento do Asaas, e `payment.pix-monitor` é a rede de segurança que varre
cobranças pendentes a cada 2 minutos, caso algum aviso se perca.

> **Precisa de Redis rodando.** Confira com `redis-cli ping` (deve responder `PONG`).

> **Se `pnpm workers` falhar**, verifique se você está no commit `f2f3a37` ou mais
> recente — dois bugs que impediam esse processo de subir (o `tsx` não declarado
> como dependência e o `.env` carregado tarde demais) foram corrigidos ali. São
> anteriores à migração; o processo de workers nunca havia rodado nesta máquina.

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

Marque conforme for passando. Os testes **5**, **6** e **8** são os mais
importantes — explico o porquê em cada um.

---

### [ ] 1. Recarga de carteira — PIX
**Onde:** Carteira → adicionar saldo → **PIX** (mínimo **R$ 5,00** — regra do Asaas)

**Esperado:** QR Code na tela, com botão de copiar o código.

**Confira:** o QR Code é real (escaneie com o celular — deve abrir como cobrança
PIX no seu banco); o valor bate com o que você digitou.

> ⚠️ **Em 05/08/2026 o sandbox do Asaas está sem gerar QR Code.** Confirmado como
> problema deles: a falha se reproduz chamando a API direto, e a própria página de
> pagamento hospedada pelo Asaas exibe *"Não foi possível gerar o QR Code neste
> momento"*. Cobranças criadas antes disso seguem com QR normal.
>
> Nesse cenário a tela mostra o botão **"Abrir página de pagamento"** em vez do
> QR — comportamento correto: a cobrança é válida e pagável, só a imagem não veio.
> **Marque este teste como "bloqueado por terceiro" e siga para o teste 2.**
> Quando o sandbox voltar, o QR aparece sozinho, sem precisar mexer em nada.

---

### [ ] 2. Recarga de carteira — Boleto
**Onde:** Carteira → adicionar saldo → **Boleto**

**Esperado:** **antes** de você selecionar, já aparece o aviso *"compensação em
até 3 dias úteis"*. Depois de gerar: linha digitável com botão copiar, botão que
abre o PDF e a data de vencimento.

**Confira:** o PDF abre de verdade; e — importante — o saldo **NÃO** é creditado
na hora. Isso é o comportamento correto: boleto só credita após compensar.
Se o saldo entrar imediatamente, é bug grave (me avise).

---

### [ ] 3. Recarga de carteira — Cartão
**Onde:** Carteira → adicionar saldo → **Cartão** → dados de teste da tabela acima

**Esperado:** aprovação em segundos, saldo creditado na hora.

**Confira:** o valor certo entrou na carteira.

---

### [ ] 4. Checkout do carrinho
**Onde:** monte um carrinho e finalize, testando os três meios.

**Esperado:** PIX e cartão liberam o envio; **boleto deixa o pedido aguardando**
(sem etiqueta) até a compensação.

**Confira:** que o boleto NÃO gera etiqueta na hora. Esse foi um dos pontos que
mais recebeu atenção — liberar envio com boleto não pago seria prejuízo direto.

---

### [ ] 5. Cadastrar cartão em Minha Conta ⚠️
**Onde:** Minha Conta → Cartões → adicionar

**Esperado:** cartão salvo, aparecendo com bandeira e últimos 4 dígitos.

**Por que importa:** este fluxo estava **100% quebrado** e foi corrigido no
penúltimo commit. É o mais provável de ainda ter aresta. Repare que agora ele
pede CEP e número do endereço — exigência do Asaas que o gateway antigo não tinha.

---

### [ ] 6. Link público do destinatário ⚠️ (abra em janela anônima)
**Onde:** gere um envio com pagamento pelo destinatário, copie o link e abra numa
**janela anônima** — é assim que o destinatário real vê.

**Esperado:** dá pra pagar com PIX, boleto **ou cartão**, sem login nenhum.

**Por que a janela anônima é essencial:** logado, você não reproduz o cenário
real. Era exatamente aqui que estava o bug mais perigoso da migração — o cartão
do destinatário era vinculado à conta de quem estivesse logado no navegador, ou
seja, **cobrança na conta errada**. A correção criou uma rota pública específica,
autorizada pelo token do link. Se der erro de "não autorizado" aqui, me avise na
hora.

---

### [ ] 7. Painel administrativo
**Onde:** `/admin/asaas`, logado como admin.

**Esperado:** ver o estado atual da configuração, trocar chave e ambiente
(Sandbox/Produção) e configurar o token de webhook.

**Confira:** salvar uma chave passa a valer **na hora**. (Antes havia um cache de
5 minutos sem invalidação — você salvava e parecia não ter funcionado.)

---

### [ ] 8. Confirmar um pagamento de verdade 🎯 (o teste definitivo)
**Onde:** no painel do Asaas em `sandbox.asaas.com`, ache uma cobrança PIX ou
boleto que você gerou nos testes acima e **simule o pagamento** por lá.

**Esperado:** com o `pnpm workers` rodando, o pedido sai de "aguardando" e o
serviço é liberado sozinho.

**Quanto tempo esperar:** se o webhook estiver configurado e sua máquina
acessível pela internet, é questão de segundos. Sem isso, o **monitor de
pendências** resolve na varredura seguinte — então **espere até 2 minutos** antes
de considerar que falhou.

**O que isso prova:** o ciclo inteiro, ponta a ponta — cobrança criada → cliente
paga → sistema descobre → serviço liberado. É o teste que valida a migração toda.

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

## Se algo quebrar — o que me mandar

Quanto mais preciso, mais cirúrgica a correção (e menos cota gasta adivinhando):

1. **Qual teste do roteiro** (o número) e **em qual passo** parou
2. **A mensagem que apareceu na tela**
3. **O que apareceu no terminal do `pnpm dev`** — geralmente é aí que está a causa
   real; a tela costuma mostrar só a consequência
4. Se o teste envolvia workers, **o que apareceu no terminal do `pnpm workers`**

Se der erro numa requisição, o painel de rede do navegador (F12 → Network) mostra
a rota chamada e a resposta — isso mata a maioria dos casos de primeira.

**Não precisa diagnosticar nada** — só reportar o que viu. O diagnóstico é comigo.

---

## Taxas do Asaas (medidas na sua conta)

| Modalidade | Taxa |
|---|---|
| Boleto | R$ 0,99 fixo |
| Cartão à vista | 1,99% + R$ 0,49 |
| Cartão parcelado | 2,16% + R$ 0,49 **por parcela** |

Sem mensalidade, sem adesão. Confirme no painel antes de ir para produção.

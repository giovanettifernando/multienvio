# DC-e — substituir a declaração de conteúdo em papel

Data: 01/09/2026
Status: aprovado, aguardando plano de implementação

---

## O problema

A Declaração de Conteúdo eletrônica (DC-e) é obrigatória desde **06/04/2026** para
transporte de bens em que não se exige documento fiscal. Ela substitui a declaração
de conteúdo em papel prevista no Protocolo ICMS 32/2001, e foi instituída pelo Ajuste
SINIEF 05/2021.

Hoje a plataforma gera um PDF de declaração de conteúdo em dois lugares
(`shared/docs/correios/declaracao-conteudo-pdf.ts` e
`modules/labels/infra/document-pdf.ts`) e anexa esse PDF à etiqueta dos Correios.
Esse documento provavelmente não tem mais validade.

## O que foi decidido

**Modalidade: o cliente emite, a plataforma guarda a chave.**

O manual prevê quatro modalidades de emissão. Três delas exigem certificado digital
A1 (ICP-Brasil), que custa dinheiro e depende do administrativo do cliente para ser
emitido — restrição que inviabiliza essas opções no momento. A quarta, "Aplicativo
disponibilizado pelo Fisco", permite ao remetente emitir gratuitamente no portal ou
app da SEFAZ, assinado pelo certificado do próprio Fisco.

A plataforma, então, não emite: ela orienta, recebe a chave de acesso e a guarda.

**Isto é um passo intermediário deliberado.** Quando houver certificado, a modalidade
marketplace entra por cima — o campo da chave continua existindo, só passa a ser
preenchido automaticamente. Nada do que se constrói aqui é jogado fora.

### Decisões do produto

| Decisão | Escolha |
|---|---|
| Checkout sem DC-e | **bloqueia** — não paga sem colar a chave |
| CPF/CNPJ do remetente | obrigatório, sem tratamento de cadastro antigo |
| Cancelamento do envio | cancela a DC-e junto quando possível (prazo SEFAZ: 24h) |
| DACE | impresso pelo cliente, no app da SEFAZ |

A decisão de bloquear o checkout é segura **porque a plataforma não fala com a
SEFAZ**. Quem emite é o cliente; não há instabilidade nossa capaz de derrubar vendas.
Numa modalidade de emissão própria essa decisão precisaria ser reavaliada.

## Respostas das transportadoras (01/09/2026)

Perguntadas sobre como tratam a DC-e hoje:

- **Elas não emitem.** "O cliente vai emitir por conta própria, a DC-e tem que ser
  dele." Isso confirma a modalidade escolhida e destrava o bloco de emissão.
- **Objetos sem DC-e ainda são aceitos**, com declaração de conteúdo em papel. Não
  há emergência — há prazo de manobra.
- **A Total Express já opera assim:** campo no sistema para o número, e o sistema
  gera a segunda via. O desenho que fizemos é o mesmo do mercado.
- **O DACE deve ser impresso junto com a nossa etiqueta**, mas não como etiqueta.

## O prazo que vale para pessoa jurídica

Do FAQ oficial do portal:

- O app do Fisco é **destinado a pessoa física**. Há também um emissor Web
  (`dce.receita.pr.gov.br`), igualmente para pessoa física.
- Para pessoa jurídica, o uso do app é permitido **apenas até 31/10/2026**,
  emitindo com o CPF do representante legal e informando o CNPJ da empresa em
  "Informações Complementares".
- Para operações recorrentes, o próprio Fisco recomenda sistema próprio ou
  software de mercado.

A plataforma atende PF e PJ. **Decisão tomada: não comprar certificado.** Depois de
31/10, o cliente pessoa jurídica emite no sistema fiscal que já usa (Bling, Tiny,
contador) e cola a chave aqui — o mesmo campo, mudando só quem emitiu.

**Decisão tomada: a declaração em papel sai de circulação, mas o código fica.** O
usuário deixa de ver e de imprimir o PDF de papel, e ele deixa de ser anexado à
etiqueta — porém nada é apagado do projeto. Os geradores e o trecho do worker ficam
comentados e identificados, para reativar sem reescrever caso a DC-e precise
retroceder ou conviver com o papel em alguma praça.

## O QR-Code sai da chave

Do Anexo II, seção 3.2.1: o QR-Code impresso no DACE contém apenas uma URL:

```
<portal da SEFAZ>/dce/qrcode?chDCe=<44 dígitos>&tpAmb=1
```

Não depende do protocolo de autorização. Como o manual exige que **o QR-Code e o
código de barras estejam visíveis na embalagem**, e ambos derivam da chave, a
plataforma consegue imprimi-los junto da etiqueta a partir do que o cliente colar.

Um DACE completo traz também o protocolo de autorização, que só a SEFAZ devolve a
quem emitiu — esse a plataforma não tem. O que se imprime aqui é o que precisa ser
lido na caixa, não uma segunda via oficial.

## Fatos apurados na fonte oficial

Do *Manual DC-e — Visão Geral* e do *Anexo I — Leiaute e Regras de Validação*
(portal SVRS, versão 1.00):

- **Uma DC-e por envio**, não por volume. O leiaute não tem campo de volume nem de
  peso; os itens de todos os volumes formam uma lista única (grupo `det`, 1-999).
- **Campos de item exigidos:** `xProd` (descrição), `qCom` (quantidade),
  `vUnCom` (valor unitário), `vProd` (valor total). `NCM` é **opcional** (`0-1`).
  São exatamente os dados que a plataforma já coleta — nenhuma mudança na tela de itens.
- **`cMun`** (código do município, IBGE, 7 dígitos) é **obrigatório** nos dois
  endereços. O ViaCEP devolve esse campo (`ibge`), então não é preciso nova fonte de dados.
- **Chave de acesso:** 44 dígitos numéricos, com dígito verificador módulo 11 — mesmo
  algoritmo da NF-e. O campo `mod` vale **99** (a NF-e é 55), o que permite rejeitar
  na hora quem colar uma chave de NF-e por engano.
- **Único evento existente: cancelamento**, com prazo de 24 horas. Passado isso a
  SEFAZ rejeita (código 501). Não existe carta de correção.
- **O DACE não é a DC-e** — é instrumento auxiliar, com a chave e o QR-Code. O manual
  exige que o **QR-Code e o código de barras estejam visíveis na embalagem**.
- Web services (SOAP, versão 1.00), para uso futuro na modalidade marketplace:
  - Produção: `https://dce.fazenda.pr.gov.br/dce/DCeAutorizacao?wsdl`
  - Homologação: `https://homologacao.dce.fazenda.pr.gov.br/dce/DCeAutorizacao?wsdl`

## O fluxo

1. O cliente escolhe "Declaração de conteúdo (DC-e)" e preenche os itens **como já faz**.
2. Na finalização aparece o bloco **"Emitir DC-e"**: os dados dele organizados para
   copiar, e um botão que abre o portal/app da SEFAZ.
3. Ele emite lá fora e volta com a chave.
4. Cola a chave; a validação roda enquanto digita.
5. Só então "Pagar agora" habilita.
6. A chave aparece no detalhe do envio e no rastreio público.

## Arquitetura

### Validação da chave — módulo isolado

Funções puras, sem banco nem rede:

- `isValidDceKey(chave)` — 44 dígitos, dígito verificador módulo 11, `mod = 99`
- `parseDceKey(chave)` — extrai UF, ano/mês, CNPJ do emitente, série, número e `tpEmit`

`tpEmit` identifica quem emitiu (`0`=App Fisco, `1`=Marketplace, `2`=Emissor próprio,
`3`=Transportadora) e serve para exibição e auditoria.

Sendo puras, essas funções são o único ponto do projeto com teste automatizado
proveitoso — e são a base de tudo o mais.

### Persistência

```
Shipment.dceKey  String?  @unique
```

Coluna própria, não dentro do JSON do documento, porque o checkout é barrado com base
nela e ela será consultada. A restrição de unicidade impede que a mesma DC-e seja
colada em vários envios — sem ela, um cliente apressado deixa vários envios sem
documento válido de verdade.

`documentType` continua `DECLARACAO`: a DC-e é a versão eletrônica da mesma coisa, e
assim os 27 arquivos que já tratam esse tipo seguem funcionando.

### Validação em duas camadas

No navegador, para o cliente ver o erro enquanto digita; no servidor, antes de gravar,
porque chave que chega por API não passa pela tela.

**Atenção a uma armadilha já vivida neste projeto:** a regra precisa entrar tanto em
`preconditionsOk` quanto no schema do formulário de finalização. A divergência entre
essas duas camadas já causou um bug em que o botão "Pagar agora" reprovava por um
campo que não estava mais na tela, sem nenhum campo em vermelho.

## Telas afetadas

| Onde | Mudança |
|---|---|
| Cadastro / conta | CPF/CNPJ passa a ser obrigatório |
| Finalização | bloco de emissão + campo da chave + trava do pagamento |
| Escolha do documento | rótulo vira "Declaração de conteúdo (DC-e)" |
| Botão "Imprimir Declaração" | para NF-e continua; para declaração passa a exibir a chave |
| Detalhe do envio e rastreio | exibem a chave |
| Worker de etiqueta | para de anexar o PDF de declaração à etiqueta dos Correios |

A plataforma **não gera o DACE**: ele depende do protocolo de autorização, que só a
SEFAZ tem. Quem imprime é o cliente.

## Ordem de construção

A fundação não depende de resposta de ninguém e serve em qualquer cenário futuro:

1. Validação da chave (com testes)
2. Coluna `dceKey` e validação no servidor
3. CPF/CNPJ obrigatório

O bloco de emissão no checkout — a parte cara — só depois da resposta das
transportadoras, porque é exatamente o que se torna desnecessário caso elas emitam.

## Lacunas conhecidas

**Não há onde enviar a chave às transportadoras.** Os campos existentes são de NF-e
(`chaveNFe` nos Correios, `chaveAcesso` na Total Express) e provavelmente rejeitam uma
chave modelo 99. Nesta versão a chave fica do nosso lado: guardada, exibida e
conferível. Se alguma transportadora tiver campo próprio, encaixa depois.

**Não se sabe o que as transportadoras estão fazendo.** Os Correios já recebem nossos
itens de declaração (`itensDeclaracaoConteudo`) e geram o documento — é plausível que
já estejam emitindo a DC-e a partir disso. Pergunta enviada ao cliente; a resposta pode
eliminar boa parte deste projeto.

**A validade da declaração em papel de hoje não foi confirmada.** Se ela caiu em abril,
os envios que estão saindo agora estão sem documento — problema do presente, não deste
projeto.

**A consequência fiscal de uma DC-e autorizada para envio cancelado é desconhecida.** O
manual só define o evento de cancelamento e o prazo; não fala em penalidade. Pergunta
para o contador do cliente, e a resposta pode mudar a regra de cancelamento.

## O que não convence neste plano

O passo manual é o ponto fraco, e é bom não disfarçar: o cliente digita tudo de novo no
app da SEFAZ, no meio do checkout. Dá para amenizar com os dados prontos para copiar,
mas não dá para preencher nada por ele — o app é da SEFAZ. Parte dos clientes vai
desistir ali, e isso vira suporte.

É esse atrito, e não a economia de R$ 300 por ano, o verdadeiro argumento para comprar
o certificado depois. Vale medir quantos abandonam nesse passo: é o número que
justifica o investimento.

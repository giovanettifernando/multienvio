# Roteiro de Testes - Usuario de Envio

> Plataforma: Envio Legal
> Escopo: Funcionalidades do usuario final (envio/frete)
> Ultima atualizacao: 2026-02-26

---

## Indice

1. [Cadastro e Verificacao de Email](#1-cadastro-e-verificacao-de-email)
2. [Login](#2-login)
3. [Recuperacao de Senha](#3-recuperacao-de-senha)
4. [Dashboard (Visao Geral)](#4-dashboard-visao-geral)
5. [Minha Conta](#5-minha-conta)
6. [Cotacao de Envio](#6-cotacao-de-envio)
7. [Carrinho e Checkout](#7-carrinho-e-checkout)
8. [Meus Envios](#8-meus-envios)
9. [Coletas](#9-coletas)
10. [Rastreamento](#10-rastreamento)
11. [Carteira](#11-carteira)
12. [Frete Destinatario](#12-frete-destinatario)
13. [Suporte](#13-suporte)

---

## Pre-requisitos

- Acesso ao ambiente de testes (staging)
- Conta de email valida para receber verificacoes
- Cartao de teste do Mercado Pago para pagamentos
- CEPs validos para origem e destino (ex: 01310-100 SP, 20040-020 RJ)
- Navegadores: Chrome (principal), Firefox e Safari (complementar)

---

## 1. Cadastro e Verificacao de Email

**Pagina:** `/auth/cadastro`

### 1.1 Cadastro com dados validos

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/auth/cadastro` | Formulario de cadastro exibido |
| 2 | Preencher nome completo | Campo aceito |
| 3 | Preencher email valido | Campo aceito |
| 4 | Preencher senha forte (8+ chars, maiuscula, minuscula, numero, especial) | Indicador de forca mostra senha forte |
| 5 | Preencher telefone (opcional) | Campo aceito |
| 6 | Marcar checkbox de Termos de Uso | Checkbox ativado |
| 7 | Clicar "Cadastrar" | Redirecionado para pagina de confirmacao. Email de verificacao enviado |

### 1.2 Validacoes de cadastro

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Enviar formulario sem preencher campos obrigatorios | Mensagens de erro nos campos obrigatorios |
| 2 | Preencher email com formato invalido (ex: "teste@") | Erro de validacao no campo email |
| 3 | Preencher senha fraca (ex: "123") | Indicador mostra senha fraca. Botao desabilitado ou erro ao enviar |
| 4 | Preencher email ja cadastrado | Mensagem de erro informando que email ja esta em uso |
| 5 | Nao marcar Termos de Uso e enviar | Erro solicitando aceite dos termos |

### 1.3 Cadastro via Google

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar "Cadastrar com Google" | Popup do Google OAuth aberta |
| 2 | Selecionar conta Google | Conta criada e autenticada. Redirecionado ao dashboard |

### 1.4 Verificacao de email

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Abrir email de verificacao recebido | Email com link de verificacao presente |
| 2 | Clicar no link de verificacao | Pagina `/auth/verify-email` exibida com sucesso |
| 3 | Tentar logar antes de verificar email | Mensagem informando que email nao foi verificado |
| 4 | Clicar em "Reenviar email de verificacao" | Novo email enviado |
| 5 | Usar link expirado (apos 1h) | Mensagem de token expirado com opcao de reenvio |

---

## 2. Login

**Pagina:** `/auth/login`

### 2.1 Login valido

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/auth/login` | Formulario de login exibido |
| 2 | Preencher email e senha corretos | Campos aceitos |
| 3 | Clicar "Entrar" | Redirecionado ao dashboard (`/`) |
| 4 | Verificar menu lateral | Menu com todas as opcoes do usuario exibido |

### 2.2 Login invalido

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Email correto + senha errada | Mensagem "Email ou senha invalidos" |
| 2 | Email inexistente + qualquer senha | Mesma mensagem generica (nao revela se email existe) |
| 3 | Campos vazios | Validacao impede envio |

### 2.3 Login via Google

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar "Entrar com Google" | Popup OAuth aberta |
| 2 | Selecionar conta | Login realizado, redirecionado ao dashboard |

### 2.4 Rate limiting

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Tentar login com senha errada 5+ vezes em 5 minutos | Mensagem de "Muitas requisicoes. Tente novamente mais tarde." (HTTP 429) |
| 2 | Aguardar janela de 5 minutos | Login liberado novamente |

### 2.5 Sessao

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Logar e fechar aba sem logout | Ao reabrir, sessao ainda ativa |
| 2 | Ficar inativo por periodo prolongado | Sessao expira, redirecionado ao login |

---

## 3. Recuperacao de Senha

**Pagina:** `/auth/forgot-password`

### 3.1 Fluxo completo

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/auth/forgot-password` | Formulario com campo de email |
| 2 | Preencher email cadastrado | Campo aceito |
| 3 | Clicar "Enviar" | Mensagem de confirmacao exibida |
| 4 | Verificar caixa de email | Email com link de redefinicao recebido |
| 5 | Clicar no link | Pagina `/auth/reset-password` com formulario de nova senha |
| 6 | Preencher nova senha (atendendo requisitos) | Indicador de forca exibido |
| 7 | Confirmar | Mensagem de sucesso. Redirecionado ao login |
| 8 | Logar com nova senha | Login bem-sucedido |

### 3.2 Validacoes

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Enviar email nao cadastrado | Mesma mensagem de confirmacao (nao revela se email existe) |
| 2 | Usar link de reset ja utilizado | Mensagem de token invalido |
| 3 | Usar link apos 1 hora | Mensagem de token expirado |
| 4 | Senha fraca no formulario de reset | Erro de validacao |

---

## 4. Dashboard (Visao Geral)

**Pagina:** `/`

### 4.1 Elementos do dashboard

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar dashboard apos login | Pagina carrega sem erros |
| 2 | Verificar card de saldo da carteira | Saldo atual exibido corretamente |
| 3 | Verificar quadro de status de envios | Contadores de envios por status exibidos |
| 4 | Verificar resumo de envios | Totais de entregues/cancelados exibidos |
| 5 | Verificar calculadora rapida de frete | Campos de CEP origem/destino e peso disponiveis |
| 6 | Verificar agenda de coletas | Proximas coletas agendadas exibidas |
| 7 | Verificar envios pendentes em pontos de coleta | Lista de envios aguardando postagem |

### 4.2 Calculadora rapida

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Preencher CEP origem e destino | CEPs validados |
| 2 | Informar peso | Campo aceito |
| 3 | Clicar "Calcular" | Estimativa de frete exibida |

---

## 5. Minha Conta

**Pagina:** `/minha-conta`

### 5.1 Dados pessoais

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/minha-conta` | Formulario pessoal e abas exibidos |
| 2 | Editar nome | Campo editavel |
| 3 | Editar nome da empresa | Campo editavel |
| 4 | Editar CNPJ/CPF | Campo editavel com mascara |
| 5 | Editar telefone | Campo editavel com mascara |
| 6 | Clicar "Salvar" | Mensagem de sucesso. Dados persistidos ao recarregar |

### 5.2 Enderecos

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar na aba "Enderecos" | Lista de enderecos exibida |
| 2 | Clicar "Adicionar endereco" | Formulario abre |
| 3 | Digitar CEP valido | Rua, cidade e estado preenchidos automaticamente via API |
| 4 | Preencher numero e complemento | Campos aceitos |
| 5 | Dar um apelido ao endereco (ex: "Escritorio") | Campo aceito |
| 6 | Salvar | Endereco adicionado a lista |
| 7 | Marcar como endereco padrao | Endereco destacado como padrao |
| 8 | Editar endereco existente | Formulario preenchido para edicao |
| 9 | Excluir endereco | Confirmacao solicitada. Endereco removido |

### 5.3 Cartoes

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar na aba "Cartoes" | Lista de cartoes exibida |
| 2 | Clicar "Adicionar cartao" | Formulario de cartao (tokenizado Mercado Pago) |
| 3 | Preencher dados do cartao de teste | Cartao salvo (exibe bandeira + ultimos 4 digitos) |
| 4 | Definir como cartao padrao | Cartao marcado como principal |
| 5 | Excluir cartao | Confirmacao solicitada. Cartao removido |

### 5.4 Destinatarios

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar na aba "Destinatarios" | Lista de destinatarios exibida |
| 2 | Clicar "Adicionar destinatario" | Formulario abre |
| 3 | Preencher nome, documento, telefone, email | Campos aceitos |
| 4 | Preencher endereco com CEP (auto-complete) | Endereco preenchido automaticamente |
| 5 | Salvar | Destinatario adicionado a lista |
| 6 | Editar destinatario | Formulario preenchido para edicao |
| 7 | Excluir destinatario | Confirmacao solicitada. Destinatario removido |
| 8 | Definir como destinatario padrao | Destinatario destacado |

### 5.5 Itens recorrentes

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar na aba "Itens Recorrentes" | Lista de itens exibida |
| 2 | Adicionar item com descricao, qtd, valor unitario, valor total | Item salvo |
| 3 | Editar item existente | Dados atualizados |
| 4 | Excluir item | Item removido |

### 5.6 Seguranca

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar na aba "Seguranca" | Formulario de troca de senha |
| 2 | Preencher senha atual correta + nova senha | Campos aceitos |
| 3 | Confirmar troca | Mensagem de sucesso |
| 4 | Logar com senha antiga | Falha no login |
| 5 | Logar com nova senha | Login bem-sucedido |
| 6 | Preencher senha atual incorreta | Erro de validacao |

---

## 6. Cotacao de Envio

**Pagina:** `/cotacoes`

### 6.1 Criar cotacao simples

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/cotacoes` | Formulario de cotacao exibido |
| 2 | Selecionar endereco de origem (ou usar padrao) | Endereco preenchido |
| 3 | Informar CEP de destino | Cidade e estado preenchidos automaticamente |
| 4 | Adicionar volume: dimensoes (CxLxA em cm) e peso (kg) | Campos aceitos |
| 5 | Selecionar tipo de embalagem (envelope, caixa, etc.) | Opcao selecionada |
| 6 | Adicionar descricao dos itens (descricao, qtd, valor) | Itens adicionados |
| 7 | Selecionar tipo de documento (NFe ou Declaracao de Conteudo) | Opcao selecionada |
| 8 | Clicar "Cotar" / "Ver cotacoes" | Lista de transportadoras com precos e prazos exibida |

### 6.2 Resultados da cotacao

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Verificar transportadoras listadas (Correios, JT, Loggi, etc.) | Ao menos uma opcao exibida |
| 2 | Verificar valor do frete de cada opcao | Valores numericos validos |
| 3 | Verificar prazo de entrega (dias uteis) | Prazos exibidos |
| 4 | Verificar servico (PAC, SEDEX, etc.) | Nome do servico visivel |

### 6.3 Cotacao com multiplos volumes

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Adicionar 2+ volumes com dimensoes diferentes | Volumes listados |
| 2 | Cotar | Preco considera todos os volumes |

### 6.4 Cotacao com destinatario salvo

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Selecionar destinatario salvo em "Minha Conta" | Dados do destinatario preenchidos automaticamente |
| 2 | Cotar | Cotacao gerada normalmente |

### 6.5 Cotacao com itens recorrentes

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Selecionar item recorrente salvo | Descricao/valor preenchidos automaticamente |
| 2 | Cotar | Cotacao gerada normalmente |

### 6.6 Servicos adicionais

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Marcar seguro (valor declarado) | Valor do seguro adicionado ao frete |
| 2 | Marcar AR (Aviso de Recebimento) | Servico adicionado |
| 3 | Marcar MP (Mao Propria) | Servico adicionado |
| 4 | Verificar impacto no preco final | Precos atualizados com adicionais |

### 6.7 Validacoes

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | CEP de destino invalido | Mensagem de erro |
| 2 | Peso zero ou negativo | Validacao impede envio |
| 3 | Dimensoes fora dos limites da transportadora | Erro ou aviso exibido |
| 4 | Cotar sem preencher campos obrigatorios | Mensagens de erro nos campos |

### 6.8 Finalizacao de cotacao

**Pagina:** `/cotacoes/finalizar`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Selecionar uma transportadora/servico | Redirecionado para finalizacao |
| 2 | Revisar dados do envio (origem, destino, volumes) | Dados corretos exibidos |
| 3 | Confirmar dados do destinatario | Dados preenchidos (nome, doc, endereco) |
| 4 | Selecionar local de postagem (ponto de coleta ou coleta) | Opcao selecionada |
| 5 | Escolher forma de pagamento (carteira ou cartao) | Opcao selecionada |
| 6 | Clicar "Finalizar" ou "Adicionar ao carrinho" | Envio criado ou item adicionado ao carrinho |

---

## 7. Carrinho e Checkout

**Pagina:** `/carrinho`

### 7.1 Visualizar carrinho

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/carrinho` | Lista de itens do carrinho exibida |
| 2 | Verificar dados de cada item (origem, destino, transportadora, valor) | Dados corretos |
| 3 | Verificar total do carrinho | Soma correta de todos os itens |

### 7.2 Gerenciar itens

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Remover item individual | Confirmacao solicitada. Item removido. Total atualizado |
| 2 | Limpar carrinho inteiro | Confirmacao solicitada. Carrinho vazio |

### 7.3 Checkout com carteira

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Ter saldo suficiente na carteira | Opcao "Pagar com carteira" disponivel |
| 2 | Clicar "Pagar com carteira" | Pagamento processado. Saldo debitado |
| 3 | Verificar envios criados | Envios aparecem em "Meus Envios" com status inicial |
| 4 | Verificar saldo atualizado | Valor do frete descontado |

### 7.4 Checkout com cartao

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Selecionar cartao salvo | Cartao selecionado |
| 2 | Confirmar pagamento | Cobranca processada. Envios criados |

### 7.5 Checkout sem saldo

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Tentar pagar com carteira sem saldo suficiente | Mensagem de saldo insuficiente. Sugestao de adicionar fundos |

---

## 8. Meus Envios

**Pagina:** `/shipments`

### 8.1 Listar envios

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/shipments` | Tabela de envios exibida |
| 2 | Verificar colunas: codigo, destinatario, status, datas, frete, acoes | Todas visiveis |
| 3 | Verificar paginacao | Navegacao entre paginas funcional |

### 8.2 Filtros e busca

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Buscar por codigo de rastreio | Envio encontrado |
| 2 | Buscar por nome do destinatario | Envios filtrados |
| 3 | Filtrar por status "Em transito" | Apenas envios em transito exibidos |
| 4 | Filtrar por status "Entregue" | Apenas envios entregues exibidos |
| 5 | Filtrar por "Aguardando coleta" | Apenas envios pendentes exibidos |
| 6 | Limpar filtros | Todos os envios exibidos novamente |

### 8.3 Acoes nos envios

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar "Imprimir etiqueta" em envio pendente | PDF da etiqueta gerado/aberto para impressao |
| 2 | Clicar "Abrir rastreamento" | Link externo da transportadora aberto |
| 3 | Clicar "Cancelar envio" (envio pendente) | Confirmacao solicitada. Envio cancelado. Frete estornado a carteira |
| 4 | Tentar cancelar envio ja em transito | Acao nao disponivel ou mensagem de erro |

### 8.4 Detalhes do envio

**Pagina:** `/shipments/{id}`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar em um envio na lista | Pagina de detalhes aberta |
| 2 | Verificar codigo de rastreio | Exibido corretamente |
| 3 | Verificar dados do destinatario | Nome, endereco, cidade, estado, CEP |
| 4 | Verificar dados do remetente | Dados da empresa |
| 5 | Verificar transportadora e servico | Informacoes corretas |
| 6 | Verificar valor do frete | Valor correto |
| 7 | Verificar volumes (peso, dimensoes) | Dados corretos |
| 8 | Verificar itens/produtos | Descricoes e valores corretos |
| 9 | Verificar timeline de rastreamento | Eventos listados cronologicamente |

---

## 9. Coletas

**Pagina:** `/coletas`

### 9.1 Listar coletas

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/coletas` | Tabela de coletas exibida |
| 2 | Verificar colunas: codigo, coletor, data, status, tentativas | Todas visiveis |
| 3 | Filtrar por status | Filtros funcionais |
| 4 | Buscar por codigo de rastreio | Coleta encontrada |

### 9.2 Solicitar nova coleta

**Pagina:** `/coletas/nova`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar "Solicitar coleta" | Formulario/wizard de coleta aberto |
| 2 | Selecionar envios pendentes para coleta | Envios marcados |
| 3 | Confirmar endereco de coleta | Endereco preenchido (default ou manual) |
| 4 | Selecionar data e horario | Data futura aceita |
| 5 | Adicionar instrucoes especiais (opcional) | Campo aceito |
| 6 | Confirmar solicitacao | Coleta criada com status "Pendente" ou "Agendada" |

### 9.3 Detalhes da coleta

**Pagina:** `/coletas/{id}`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar em uma coleta na lista | Detalhes exibidos |
| 2 | Verificar dados do coletor | Nome e informacoes do coletor |
| 3 | Verificar envios vinculados | Lista de envios desta coleta |
| 4 | Verificar historico de tentativas | Se houve tentativas anteriores |

---

## 10. Rastreamento

**Pagina:** `/rastreamento`

### 10.1 Listar rastreamentos

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/rastreamento` | Lista de envios com status de rastreamento |
| 2 | Verificar ultimo evento de cada envio | Descricao e data do evento |
| 3 | Buscar por codigo de rastreio | Envio encontrado |
| 4 | Filtrar por "Em transito" | Apenas envios em transito |
| 5 | Filtrar por "Entregue" | Apenas envios entregues |
| 6 | Filtrar por "Ocorrencia" | Envios com problema |

### 10.2 Detalhes do rastreamento

**Pagina:** `/rastreamento/{id}`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar em um envio | Timeline completa de eventos exibida |
| 2 | Verificar cada evento: data, status, local, descricao | Dados corretos |
| 3 | Verificar previsao de entrega | Data estimada exibida |
| 4 | Verificar dados do envio (remetente, destinatario, servico) | Corretos |

---

## 11. Carteira

**Pagina:** `/carteira`

### 11.1 Visao geral da carteira

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/carteira` | Pagina da carteira exibida |
| 2 | Verificar saldo atual | Valor correto exibido |
| 3 | Verificar resumo mensal de gastos | Valores exibidos |
| 4 | Verificar transacoes recentes | Ultimas movimentacoes listadas |

### 11.2 Adicionar fundos

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar "Adicionar fundos" | Modal aberto |
| 2 | Informar valor | Campo aceito |
| 3 | Selecionar cartao | Cartao selecionado |
| 4 | Confirmar | Cobranca processada. Saldo atualizado imediatamente |
| 5 | Verificar transacao no extrato | Credito registrado |

### 11.3 Sem cartao cadastrado

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar carteira sem cartao salvo | Alerta sugerindo cadastrar cartao em "Minha Conta" |

### 11.4 Extrato

**Pagina:** `/carteira/extrato`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/carteira/extrato` | Extrato com transacoes exibido |
| 2 | Filtrar por periodo (data inicio e fim) | Transacoes filtradas |
| 3 | Buscar por palavra-chave | Resultados filtrados |
| 4 | Verificar colunas: data, tipo, descricao, valor, saldo | Todas visiveis |
| 5 | Verificar card de resumo do periodo (entradas, saidas, saldo) | Valores corretos |
| 6 | Navegar paginacao | Paginas carregam corretamente |
| 7 | Baixar/imprimir PDF do extrato | PDF gerado com transacoes do periodo |

### 11.5 Metodos de pagamento

**Pagina:** `/carteira/metodos`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/carteira/metodos` | Lista de cartoes exibida |
| 2 | Adicionar novo cartao | Cartao salvo (bandeira + ultimos 4 digitos) |
| 3 | Definir como padrao | Cartao marcado como principal |
| 4 | Excluir cartao | Confirmacao solicitada. Cartao removido |

### 11.6 Faturas

**Pagina:** `/carteira/faturas`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/carteira/faturas` | Lista de faturas exibida |
| 2 | Verificar dados: numero, data, valor, status | Corretos |
| 3 | Gerar nova fatura | Fatura criada |

---

## 12. Frete Destinatario

**Pagina:** `/pagamentos-pendentes`

### 12.1 Listar pagamentos pendentes

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/pagamentos-pendentes` | Tabela de pagamentos exibida |
| 2 | Verificar colunas: destinatario, email, cidade, valor, status, expiracao | Dados corretos |

### 12.2 Acoes

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar "Copiar link" em pagamento pendente | Link copiado para clipboard |
| 2 | Clicar "Reenviar email" | Email reenviado ao destinatario |
| 3 | Clicar "Cancelar" em pagamento pendente | Confirmacao solicitada. Pagamento cancelado |
| 4 | Verificar pagamento ja pago | Status "Pago" com link para envio associado |

### 12.3 Pagina publica de pagamento (destinatario)

**Pagina:** `/pagar/{token}`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar link de pagamento (sem login) | Pagina publica com detalhes do envio e valor |
| 2 | Verificar dados: origem, destino, valor, countdown | Informacoes corretas |
| 3 | Preencher dados do cartao | Formulario de pagamento funcional |
| 4 | Confirmar pagamento | Sucesso exibido com info de rastreamento |
| 5 | Acessar link de pagamento ja pago | Status "Pago" exibido |
| 6 | Acessar link expirado | Status "Expirado" exibido |
| 7 | Acessar link cancelado | Status "Cancelado" exibido |

---

## 13. Suporte

**Pagina:** `/suporte`

### 13.1 Central de suporte

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Acessar `/suporte` | Pagina com FAQ e lista de chamados |
| 2 | Navegar pelo FAQ | Perguntas e respostas exibidas por categoria |
| 3 | Ver lista de chamados | Chamados abertos/fechados listados |

### 13.2 Abrir novo chamado

**Pagina:** `/suporte/novo`

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar "Abrir chamado" | Formulario exibido |
| 2 | Preencher assunto | Campo aceito |
| 3 | Selecionar categoria (envio, pagamento, conta, outro) | Opcao selecionada |
| 4 | Selecionar prioridade | Opcao selecionada |
| 5 | Preencher descricao detalhada | Campo aceito |
| 6 | Anexar arquivo (opcional) | Upload realizado |
| 7 | Enviar | Chamado criado com ID. Confirmacao exibida |

### 13.3 Acompanhar chamado

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Clicar em chamado na lista | Detalhes/conversa abertos |
| 2 | Ler mensagens do suporte | Thread de conversa exibida |
| 3 | Responder ao chamado | Mensagem enviada |
| 4 | Anexar arquivo na resposta | Upload funcional |
| 5 | Fechar chamado (marcar como resolvido) | Status atualizado para "Resolvido" |
| 6 | Reabrir chamado fechado | Status volta para "Aberto" |

---

## Fluxo Completo (End-to-End)

Este teste simula o ciclo completo de um usuario novo:

| Passo | Acao | Resultado esperado |
|-------|------|--------------------|
| 1 | Criar conta em `/auth/cadastro` | Conta criada |
| 2 | Verificar email | Email confirmado |
| 3 | Logar | Acesso ao dashboard |
| 4 | Preencher dados da empresa em `/minha-conta` | Dados salvos |
| 5 | Cadastrar endereco de origem | Endereco salvo |
| 6 | Cadastrar cartao de pagamento | Cartao tokenizado |
| 7 | Adicionar fundos a carteira | Saldo disponivel |
| 8 | Criar cotacao em `/cotacoes` | Opcoes de frete exibidas |
| 9 | Selecionar transportadora e finalizar | Envio criado ou adicionado ao carrinho |
| 10 | (Se carrinho) Fazer checkout | Pagamento processado |
| 11 | Imprimir etiqueta em `/shipments` | PDF gerado |
| 12 | Acompanhar rastreamento em `/rastreamento` | Timeline de eventos |
| 13 | Verificar debito no extrato em `/carteira/extrato` | Transacao registrada |

---

## Observacoes para Testers

- **Ambiente**: Sempre testar em staging. Nunca usar dados reais de cartao.
- **Cartoes de teste**: Usar cartoes de teste do Mercado Pago (consultar documentacao MP sandbox).
- **CEPs de teste**: Usar CEPs reais (01310-100 para SP, 20040-020 para RJ, 30130-000 para BH).
- **Screenshots**: Capturar tela em caso de erro inesperado.
- **Console do navegador**: Verificar se ha erros no console (F12) durante os testes.
- **Responsividade**: Testar os fluxos principais tambem em tela de celular (Chrome DevTools).
- **Bugs**: Reportar com: pagina, passo, resultado esperado vs resultado obtido, screenshot e logs do console.

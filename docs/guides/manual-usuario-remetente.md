# Manual do Usuário Remetente – Envio Legal

## 1. Visão geral da Envio Legal
- Plataforma para cotar envios, gerar etiquetas, pagar fretes e acompanhar rastreio em um só lugar.
- A navegação principal fica na barra lateral com atalhos como “Cotar envio”, “Carrinho”, “Gestão de envios”, “Coletas”, “Carteira”, “Suporte” e “Minha conta”.
- Após login, o painel “Painel de Controle” mostra status dos envios, atalhos de suporte, carteira e coletas agendadas.

## 2. Acesso à plataforma
### Login
1) Acesse `/auth/login`.
2) Preencha **E-mail** e **Senha**. Opcional: marque **“Lembrar meu e-mail”**.
3) Clique em **“Entrar”**. Também é possível usar **“Continuar com Google”**.
4) Se as credenciais estiverem corretas, você será levado ao painel. Erros são exibidos no topo do formulário.

### Recuperação de senha
1) Na tela de login, clique em **“Esqueci minha senha”**.
2) Em **“Redefinir senha”**, informe seu **E-mail** e clique em **“Enviar link de redefinição”**. Um alerta confirma o envio.
3) No e-mail recebido, abra o link de redefinição.
4) Na página **“Definir nova senha”**, informe a nova senha seguindo os requisitos exibidos e clique em **“Atualizar senha”**. Você será redirecionado ao login.

## 3. Dashboard inicial
- **Status dos Envios**: cartões para “Aguardando coleta/postagem”, “Em trânsito”, “Entregues” etc. Clique no cartão para abrir “Gestão de envios” já filtrada.
- **Calculadora (cotação rápida)**: campos **CEP Origem**, **CEP Destino**, **Peso (kg)**, dimensões. Clique em **“Calcular”** para ver opções simuladas; use o link **“Cotação”** para ir ao fluxo completo.
- **Carteira**: mostra saldo, botão **“Adicionar créditos”** e gastos dos últimos 30 dias.
- **Transações Recentes**: lista os últimos movimentos e o atalho **“Ver todas”** para o histórico.
- **Tickets de Suporte**: mostra seus chamados com status e botões **“Abrir ticket”** e **“Ver todos”**.
- **Coletas Agendadas**: lista próximos agendamentos e link para detalhes.
- **Aguardando Postagem**: envios que precisam ser levados ao ponto de coleta, com link para o envio.

## 4. Minha Conta
### Dados pessoais
- Em **“Minha Conta”** atualize: **Nome completo**, **Telefone**, **CPF** e (opcional) foto de perfil. O **E-mail** aparece bloqueado.
- Ative **“Adicionar dados de empresa”** para preencher **CNPJ** e **Razão social**.
- Use **“Salvar”** para gravar ou **“Cancelar”** para descartar alterações.

### Abas da conta
- **Endereços**: botão **“Adicionar endereço”** abre formulário com **Apelido**, **CEP** (auto preenche logradouro/bairro/cidade/UF), **Número**, **Complemento**, opção **“Marcar como padrão”**. Na lista, use **“Tornar padrão”**, **“Editar”** ou **“Remover”**.
- **Cartões de pagamento**: **“Adicionar cartão”** (Titular, Número, Mês, Ano, CVC). Em cada cartão, use **“Definir como principal”** ou **“Remover”**.
- **Destinatários**: **“Adicionar destinatário”**, busca e paginação. Ações: **“Definir como padrão”**, **“Editar”**, **“Remover”**.
- **Itens recorrentes**: tabela com **Descrição** e **Valor Unitário (R$)**. Botões para **Adicionar item**, **Editar**, **Salvar**, **Cancelar**, **Excluir** ou **Importar CSV**.
- **Segurança**: altere a senha com **Senha atual**, **Nova senha**, **Confirmar nova senha** e botão **“Atualizar senha”** (redireciona ao login após sucesso).

## 5. Cotações e criação de envios
### Iniciar uma nova cotação (`/cotacoes`)
1) Escolha o tipo de fluxo com o seletor **“Envio” / “Logística Reversa”**.
2) **Origem** (card “1) Origem” ou “2) Destino” se reversa): selecione o **“Endereço selecionado”** salvo. Opcional: ative **“Solicitar coleta na origem”** (quando disponível para o CEP).
3) **Destino/Remetente do cliente**: escolha entre **“Informar manualmente o CEP”** (campo **CEP de destino** ou **CEP do remetente** na reversa) ou **“Selecionar destinatário recorrente”**. Ao informar o CEP manual, a cidade/UF são carregadas automaticamente.
4) **Seguro**: campo **“Valor do seguro (R$)”** (opcional).
5) **Volumes do envio**: para cada **Volume** preencha **Comprimento (cm)**, **Largura (cm)**, **Altura (cm)**, **Peso (kg)**. Opcional: selecione uma embalagem em **“Minhas embalagens”**. Use **“Adicionar volume”** para múltiplos pacotes. Veja o **Peso cubado total** no banner.
6) Clique em **“Recalcular”** para buscar cotações. Um alerta mostra quantas opções foram encontradas e um cronômetro indica a validade (30 minutos).
7) Na tabela de resultados, avalie **Transportadora**, **Serviço**, **Preço**, **Prazo** e clique em **“Escolher”** na opção desejada.

### Finalizar envio (`/cotacoes/finalizar`)
1) Revise o resumo e valores; o card **“Pagamento”** mostra **“Adicionar ao carrinho”** e **“Pagar agora”**.
2) **Documento do envio**:
   - Aba **“Nota Fiscal”**: informe a chave de acesso por pacote ou arraste o XML em **“Arraste os XMLs das NF-e…”**.
   - Aba **“Declaração de conteúdo”**: para cada item, preencha **Descrição do item**, **Valor unitário (R$)**, **Quantidade** e use **“Adicionar item”**. Em envios com vários volumes, a declaração pode ser por volume.
3) **Ponto de postagem**: escolha um ponto na lista (busca e ordenação por distância) ou mantenha a coleta na origem se ativada. É possível marcar **“Definir como padrão”**.
4) **Destinatário**: formulário pré-preenchido com o CEP da cotação. Complete **Nome completo**, **Telefone**, **E-mail**, **CPF/CNPJ**, **Número**, **Complemento**, **Observações**. Campos de endereço (CEP, Logradouro, Bairro, Cidade, UF) vêm bloqueados. Opcional: marque **“Salvar destinatário recorrente”**.
5) **Pagar agora**: abre o modal de pagamento para concluir o envio imediatamente (PIX, cartão ou carteira, quando disponível).
6) **Adicionar ao carrinho**: guarda a cotação para pagamento em lote no carrinho.
7) Use **“Voltar”** se precisar retornar à etapa anterior.

## 6. Carrinho
- Página **“Carrinho”** mostra os itens com **Transportadora/Modalidade**, **Rotas**, **Volumes** e **Preço**.
- Ações por item: botão **“Remover”** (confirmação “Remover item”).
- Ações gerais: **“Novo envio”** (volta para cotação limpando o estado), **“Limpar carrinho”**, **“Finalizar pagamento”**.
- Pagamento em lote abre o modal **“Escolha o método de pagamento”**:
  - **Saldo em carteira** (se houver saldo suficiente).
  - **PIX** (gera QR Code).
  - **Cartão de crédito** (usar cartão salvo ou cadastrar no ato).
- Após pagamento aprovado, os envios são criados e o carrinho é esvaziado. Carrinho vazio exibe **“Seu carrinho está vazio”** com atalho **“Cotar envio”**.

## 7. Pagamentos e Carteira
- **Carteira** (`/carteira`): mostra **Saldo disponível**, botão **“Adicionar saldo”** (abre modal para recarga via PIX ou cartão) e alerta de saldo negativo com **“Resolver pendências”**. Card **“Resumo do Mês”** exibe créditos, débitos e saldo. **“Últimas transações”** lista os movimentos e link **“Ver extrato completo”**.
- **Extrato da Carteira** (`/carteira/extrato`): filtre por período (até 12 meses) e busca. Botão **“Imprimir / PDF”** gera o extrato. Tabela paginada mostra tipo, valor e descrição.
- **Métodos de pagamento** (`/carteira/metodos`): botões **“Adicionar cartão”** (Titular, Número, Mês, Ano, CVC) e **“Adicionar saldo”**. Cada cartão permite **“Definir como padrão”** ou **“Remover”**.
- **Faturas e recibos** (`/carteira/faturas`): botão **“Gerar nova fatura”** (valor em R$) e lista com **“Baixar PDF”**. Há aviso de que esta seção está em modo de demonstração.
- Diferença de uso: você pode pagar cada envio diretamente em **“Pagar agora”** / carrinho com PIX, cartão ou carteira. A recarga de carteira (**“Adicionar saldo”**) serve para antecipar créditos e usar **Saldo em carteira** como método de pagamento.

## 8. Meus Envios (Gestão de envios)
### Lista (`/shipments`)
- Filtros: busca **“Buscar por rastreio, destinatário, cidade ou transportadora”**, seletor de **Status** (Todos, Aguardando coleta/postagem, Postado, Em trânsito, Em rota de entrega, Entregue, Cancelado, Devolvido) e botão **“Atualizar”**.
- Tabela mostra **Código de rastreio** (alerta “Divergência registrada” abre detalhes), **Destinatário**, **Transportadora**, **Status** (com tag de coleta quando aplicável), **Data de criação**, **Data prevista de entrega**, **Valor do frete**.
- Ações por envio:
  - **Ver detalhes** (botão verde).
  - **Imprimir etiqueta** (abre a etiqueta em nova aba e marca como impressa).
  - **Abrir rastreio** (link público).
  - **Ver coleta** (se houver coleta vinculada).
  - **Cancelar envio** (desabilitado para Entregue/Cancelado/Devolvido).

### Detalhe do envio (`/shipments/[id]`)
- Mostra status, código de rastreio, método de pagamento (Carteira/PIX/Cartão), destinatário e endereço, transportadora/serviço, prazo estimado, valores e datas.
- Botões **“Copiar link”** e **“Abrir link”** para compartilhar o rastreio público.
- Cards com **Volumes do Envio** (dimensões, peso e itens por volume), **Notas Fiscais Eletrônicas** ou **Itens da declaração** quando existentes, e **Linha do tempo** do rastreio.

### Etiquetas (`/etiquetas`)
- Filtros: **Buscar por código do envio...** e status (**Todos os status**, **Faltam imprimir**, **Já impressas**).
- Ação **“Visualizar”** abre a modal da etiqueta com opções:
  - Marcar **“Marcar etiqueta como impressa”** (ou visualizar status “Etiqueta já impressa”).
  - **“Baixar PDF”**.
  - **“Imprimir”** (abre uma janela de impressão).

### Rastreamento (`/rastreamento`)
- Lista envios com filtros por status rápidos (Todos, Em trânsito, Saiu para entrega, Entregue, Ocorrência) e busca por ID de envio. Clique em **“Ver detalhes”** para abrir o rastreamento específico.
- Detalhe de rastreio mostra resumo do envio, status com tag e **Linha do tempo**. Há campos **“Adicionar evento”** e **“Simular webhook”** para testar atualizações manualmente (úteis para suporte/homologação).

## 9. Coletas
### Lista (`/coletas`)
- Filtros: **Buscar por código de rastreio**, seletor de **Status** (Todos, Pendente, Agendada, Falhou, Cancelada, Concluída), **Data início/fim** e botão **“Atualizar”**.
- Tabela mostra **Código de rastreio** (linka para o envio), **Nome do Coletor**, **Data e hora agendadas**, **Status** e **Tentativas de Coleta**.

### Solicitar coleta (`/coletas/nova`)
1) Etapa **Origem**: mostra o endereço da empresa/remetente usado como ponto de retirada.
2) Etapa **Selecione os envios**: marque os envios que deseja incluir na coleta.
3) Etapa **Agendamento**: preencha **Data**, **Início**, **Fim**, escolha **Transportadora preferencial** (Qualquer, Correios, Jadlog, Loggi, J&T) e **Observações**.
4) Navegue com **“Próximo”** e **“Voltar”**. Conclua em **“Confirmar coleta”**.

### Detalhe da coleta (`/coletas/[id]`)
- Mostra **Status**, horário **Agendamento**, **Transportadora** preferencial, totais de envios/peso e seção **Manifesto** com **“Gerar manifesto”** ou **“Baixar manifesto”**.
- **Eventos** exibem a linha do tempo da coleta.
- Formulários **“Atualizar status”** (Agendada, Motorista atribuído, Coletada, Falha, Cancelada) e **“Simular webhook”** permitem ajustar/validar o fluxo. Use somente se precisar atualizar manualmente.

## 10. Suporte
- Página **“Central de Suporte”** (`/suporte`):
  - **Perguntas Frequentes** com busca, categorias e feedback (“Sim/Não”).
  - **Meus Chamados** lista os tickets com filtros e botão **“Abrir ticket”**.
  - Clique em um ticket para abrir o painel lateral de detalhes.
- **Abrir ticket** (`/suporte/novo`): preencha **Nome**, **E-mail**, **Telefone (opcional)**, **Assunto**, **Prioridade** (Baixa, Média, Alta, Crítica), **Descrição** e clique em **“Abrir chamado”**. Botão **“Limpar”** reseta campos (dados pessoais permanecem se você estiver logado).
- **Detalhe do ticket** (`/suporte/[id]` ou painel lateral): mostra solicitante, descrição, datas, prioridade/status e **Histórico de Mensagens**. Use a caixa **“Digite sua mensagem...”**, **“Anexar arquivo”** e **“Enviar”** para responder. Links de anexos podem ser abertos diretamente.

## 11. Boas práticas e recomendações
- Sempre preencha CEP no formato **00000-000** para evitar erros de endereço.
- Mantenha **Endereços** e **Destinatários** atualizados antes de cotar; isso acelera o preenchimento e evita falhas na postagem/coleta.
- Meça os **Volumes** com atenção (Comprimento, Largura, Altura e Peso). Divergências podem gerar cobranças adicionais ou bloqueios.
- Use **Declaração de conteúdo** ou **Nota Fiscal** coerentes com o que será enviado; valores declarados impactam seguro e despacho.
- Se usar **“Solicitar coleta na origem”**, garanta acesso fácil ao endereço na janela de horário escolhida.
- Antes de pagar, confira o saldo na **Carteira**; com saldo suficiente, o método **Saldo em carteira** agiliza o checkout.
- Após criar envios, imprima as **Etiquetas** e mantenha-as legíveis e bem fixadas.
- Utilize o rastreio público (“Abrir rastreio” / “Copiar link”) para compartilhar com o destinatário.
- Para chamados de suporte, inclua evidências (prints, comprovantes, XML da NF-e) para agilizar a solução.

## Revisão futura
- Incluir capturas de tela e GIFs dos principais fluxos (cotação, pagamento, impressão de etiqueta).
- Detalhar exemplos de preenchimento de declaração e NF-e por volume.
- Documentar fluxos avançados (importação em massa, simulações de webhook) com passo a passo visual.
- Consolidar atalho direto para histórico completo de transações na Carteira.

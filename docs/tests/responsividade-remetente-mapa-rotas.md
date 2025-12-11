# Mapa de rotas do remetente para testes de responsividade

| Rota | Descrição | Tipo de tela | Prioridade |
| --- | --- | --- | --- |
| / | Painel de controle com cartões de status/financeiro | dashboard | Alta |
| /shipments | Listagem de envios com filtros e ações | lista | Alta |
| /shipments/[id] | Detalhe de envio (timeline, dados) | detalhe | Média |
| /cotacoes | Formulário/wizard de cotação | formulário | Alta |
| /cotacoes/finalizar | Revisão e pagamento da cotação | wizard | Alta |
| /carrinho | Revisão de itens e checkout rápido | lista/formulário | Alta |
| /etiquetas | Listagem de etiquetas e ações de impressão | lista | Alta |
| /coletas | Gerenciar coletas (listagem e filtros) | lista | Alta |
| /coletas/nova | Solicitar coleta | formulário | Média |
| /coletas/[id] | Detalhe/andamento da coleta | detalhe | Média |
| /carteira | Visão geral da carteira e saldo | dashboard | Alta |
| /carteira/extrato | Extrato com tabela e filtros de datas | lista | Alta |
| /carteira/faturas | Faturas e recibos | lista | Alta |
| /carteira/metodos | Métodos de pagamento | formulário/lista | Média |
| /rastreamento | Lista de rastreamentos com filtros | lista | Média |
| /rastreamento/[id] | Detalhe de rastreamento do envio | detalhe | Média |
| /suporte | Central de suporte + lista de tickets | lista | Alta |
| /suporte/novo | Abertura de chamado | formulário | Média |
| /suporte/[id] | Detalhe do chamado | detalhe | Média |
| /minha-conta | Dados cadastrais e preferências | formulário | Média |
| /cotar | Redirect para /cotacoes (incluso por referência) | redirect | Baixa |

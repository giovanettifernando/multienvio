# Relatório de responsividade – aplicação do remetente

## Resumo executivo
- Telas exercitadas: 13 rotas principais x 2 viewports (desktop 1440x900 e mobile 390x844) = 26 cenários.
- Passaram: 0 | Falharam: 26.
- Motivo raiz: a aplicação não renderizou as páginas protegidas em dev por falta de variáveis críticas (`NEXTAUTH_SECRET`, `JWT_SECRET`, etc.) e sessão válida no servidor. O Next exibiu overlay de erro antes dos títulos carregarem, impedindo a validação de layout/responsividade.
- Log durante a execução: `Missing or invalid critical environment variables: NEXTAUTH_SECRET...` e avisos de `/api/wallet`, `/api/coletas`, `/api/shipments` exigindo autenticação.

## Principais problemas encontrados
- BUG_RESPONSIVIDADE_CRITICO: todas as rotas testadas renderizaram overlay de erro (por ambiente incompleto) em vez do conteúdo esperado. Não foi possível verificar grid/sidebar ou overflow.

## Resultados por rota
| Rota | Tipo de tela | Desktop | Mobile | Problemas encontrados | Categoria |
| --- | --- | --- | --- | --- | --- |
| / | dashboard | Issue | Issue | Página não carregou (overlay de erro por ausência de NEXTAUTH_SECRET/ sessão) | BUG_RESPONSIVIDADE_CRITICO |
| /shipments | lista | Issue | Issue | Redirecionada/erro antes do título “Gestão de envios” | BUG_RESPONSIVIDADE_CRITICO |
| /cotacoes | formulário | Issue | Issue | Overlay de erro no carregamento inicial | BUG_RESPONSIVIDADE_CRITICO |
| /cotacoes/finalizar | wizard | Issue | Issue | Conteúdo não renderizado (erro de ambiente) | BUG_RESPONSIVIDADE_CRITICO |
| /carrinho | lista/formulário | Issue | Issue | Overlay de erro antes do título “Carrinho” | BUG_RESPONSIVIDADE_CRITICO |
| /etiquetas | lista | Issue | Issue | Página não renderizou (erro de ambiente) | BUG_RESPONSIVIDADE_CRITICO |
| /coletas | lista | Issue | Issue | Overlay de erro no carregamento | BUG_RESPONSIVIDADE_CRITICO |
| /carteira | dashboard | Issue | Issue | Conteúdo indisponível por falha de ambiente | BUG_RESPONSIVIDADE_CRITICO |
| /carteira/extrato | lista | Issue | Issue | Título “Extrato da Carteira” não apareceu (erro global) | BUG_RESPONSIVIDADE_CRITICO |
| /carteira/faturas | lista | Issue | Issue | Overlay de erro antes da tabela de faturas | BUG_RESPONSIVIDADE_CRITICO |
| /suporte | lista | Issue | Issue | Página não carrega (erro de ambiente) | BUG_RESPONSIVIDADE_CRITICO |
| /rastreamento | lista | Issue | Issue | Conteúdo bloqueado por erro de ambiente | BUG_RESPONSIVIDADE_CRITICO |
| /minha-conta | formulário | Issue | Issue | Overlay de erro impede verificação de layout | BUG_RESPONSIVIDADE_CRITICO |

## Recomendações iniciais (prioridade)
1) Preparar ambiente de teste e2e: definir `NEXTAUTH_SECRET`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `COLLECTOR_JWT_SECRET` e um `DATABASE_URL` acessível em dev; popular `TEST_REMETENTE_EMAIL`/`TEST_REMETENTE_PASSWORD` para login real ou provisionar um usuário de teste.
2) Reexecutar a suíte após o ambiente estar completo: `pnpm test:e2e -- --grep "@responsive" --project=chromium-desktop --project=chromium-mobile`.
3) Opcional: expor modo de mocks para SSR/API nas rotas usadas pelas páginas do remetente (`/api/shipments`, `/api/wallet`, `/api/coletas`, `/api/support`, `/api/labels`) para permitir validação de layout sem dependência de backend real.

## Artefatos criados
- Suite: `tests/e2e/remetente/responsive.spec.ts`
- Helpers: `tests/e2e/utils/auth.ts`, `tests/e2e/utils/layout.ts`
- data-testid documentados: `testids-remetente.md`
- Mapa de rotas: `responsividade-remetente-mapa-rotas.md`

## Como rodar novamente
```bash
pnpm test:e2e -- --grep "@responsive" --project=chromium-desktop --project=chromium-mobile
```

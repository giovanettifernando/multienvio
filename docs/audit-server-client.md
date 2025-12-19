# Auditoria de Server/Client Components (Next.js App Router) - Envio Legal

## A) Resumo executivo (10 linhas)
1) Aderencia geral: 62/100 (server-first parcial; /admin layout/page ainda client).
2) Risco 1 (CRITICO): `app/(admin)/admin/layout.tsx` define o boundary client no topo do /admin.
3) Risco 2 (CRITICO): `app/(admin)/admin/config/sql/page.tsx` torna a pagina toda client.
4) Risco 3 (ALTO): utilitarios/shared com DOM/localStorage sem `client-only` sao frageis.
5) Risco 4 (MEDIO): imports de `@/platform` em client misturam camadas.
6) Risco 5 (MEDIO): hooks/estado client sem marcacao explicita podem ser importados no server.
7) Quick win 1: refatorar o layout admin para server + shell client.
8) Quick win 2: extrair a UI do SQL para componente client e manter page server.
9) Quick win 3: aplicar `client-only` em utilitarios DOM/localStorage mais usados.
10) Quick win 4-5: mover barcode-generator p/ camada client + `server-only` em platform/db/integrations.

## B) Achados detalhados por severidade

### [CRITICO] Layout admin marcado como client (boundary no topo)
- Evidencia: `app/(admin)/admin/layout.tsx:1` `"use client";`
- Impacto: toda a arvore `/admin` vira client, aumenta bundle/hidratacao e bloqueia imports server-only.
- Correcao sugerida: manter layout server e mover responsividade/auth/menus para um `AdminShellClient`/`providers.tsx` client.

### [CRITICO] Pagina `/admin/config/sql` e Client Component
- Evidencia: `app/(admin)/admin/config/sql/page.tsx:1` `'use client';`
- Impacto: pagina inteira client-side, sem SSR/streaming e com maior JS.
- Correcao sugerida: criar `<AdminSqlClient />` e manter `page.tsx` server.

### [ALTO] Utilitarios/infra com APIs de navegador sem `client-only`
- Evidencia: `shared/utils/pdf.ts:20` `const iframe = document.createElement('iframe');`
- Evidencia: `modules/labels/infra/document-pdf.ts:703` `window.open(pdfUrl, '_blank');`
- Evidencia: `modules/labels/application/cache.ts:9` `localStorage.getItem(...)`
- Evidencia: `modules/quotes/ui/state/useQuoteStore.ts:112` `return window.localStorage;`
- Evidencia: `modules/cart/ui/state/useCheckoutStore.ts:33` `createJSONStorage(() => localStorage)`
- Evidencia: `modules/pickup-points/ui/state/usePickupPointsStore.ts:155` `localStorage.getItem(...)`
- Impacto: qualquer import por Server Components/route quebra build ou runtime e cria boundary implicito.
- Correcao sugerida: adicionar `import 'client-only'` e realocar para camada `ui` quando apropriado.

### [ALTO] Componentes client importando gerador de barcode em `@/platform` com DOM/bwip-js
- Evidencia: `modules/labels/ui/components/EtiquetaGenerica.tsx:11` `import { generateCode128 } ...`
- Evidencia: `platform/integrations/correios/barcode-generator.ts:28` `document.createElement("canvas")`
- Impacto: mistura camada server/cliente e pode inflar bundle; risco se o modulo ganhar dependencias server-only.
- Correcao sugerida: mover o gerador para camada client (`modules/labels/ui` ou `shared/ui`) e marcar `client-only`/lazy-load.

### [MEDIO] Hooks/helpers client sem marcacao explicita em modulos compartilhados
- Evidencia: `shared/hooks/useFipeVehicles.ts:5` `useState/useEffect`
- Evidencia: `modules/shipments/ui/hooks/useInvoiceItems.ts:1` `useState`
- Evidencia: `modules/pickup-points/ui/hooks/usePickupPointsAPI.ts:1` `useState`
- Evidencia: `modules/quotes/ui/components/quoteFormHelpers.ts:102` `window.dispatchEvent(...)`
- Evidencia: `modules/admin/application/auth.ts:13` `typeof document`
- Impacto: facil import acidental por Server Components, tornando o boundary fragil.
- Correcao sugerida: adicionar `import 'client-only'` (ou `use client` nos entrypoints) e manter esses modulos em `modules/*/ui` ou `shared/ui`.

### [MEDIO] Client components importam modulos em `@/platform` (camada tipicamente server)
- Evidencia: `shared/hooks/useCepLookup.ts:4` `from "@/platform/integrations/shared/brasilapi"`
- Evidencia: `modules/labels/ui/components/LabelsTable.tsx:22` `from '@/platform/api/labels'`
- Impacto: governanca server/client fica confusa e abre risco futuro de import server-only.
- Correcao sugerida: mover APIs client-safe para `shared/api` ou `modules/*/ui` e marcar `client-only`.

### [BAIXO] Uso de `process.env` no client restrito a `NODE_ENV`/`NEXT_PUBLIC_*`
- Evidencia: `app/(envio)/pagamentos-pendentes/RecipientPaymentsClient.tsx:178` `process.env.NEXT_PUBLIC_APP_URL`
- Evidencia: `app/(envio)/error.tsx:66` `process.env.NODE_ENV`
- Evidencia: `modules/auth/ui/components/CardModal.tsx:136` `process.env.NODE_ENV`
- Impacto: baixo; risco apenas se variaveis secretas forem adicionadas no client.
- Correcao sugerida: manter apenas `NEXT_PUBLIC_*` no client e aplicar `server-only` em modulos com segredos.

### [BAIXO] Backups com `use client` dentro de `app/`
- Evidencia: `app/(envio)/suporte/page.tsx.backup:1` `"use client";`
- Evidencia: `app/(admin)/admin/suporte/page.tsx.backup:1` `"use client";`
- Impacto: ruido/risco operacional (pode virar rota por engano).
- Correcao sugerida: mover para fora de `app/` ou remover.

### [BAIXO] Serializacao Server -> Client ok onde ocorre
- Evidencia: `app/(admin)/admin/contas/page.tsx:88` `createdAt: user.createdAt.toISOString()`
- Impacto: sem riscos atuais; manter padrao de DTO/normalizacao.

## C) Mapa final

### Lista de todos os `use client` + categoria

#### A) Pagina/Layout
`app/(admin)/admin/layout.tsx`  
`app/(admin)/admin/config/sql/page.tsx`

#### B) Provider
`shared/ui/providers/app-providers.tsx`

#### C) Componente UI interativo
`modules/admin/ui/components/finance/InvoicesTable.tsx`  
`modules/admin/ui/components/finance/ChargebacksTable.tsx`  
`modules/admin/ui/components/finance/CommissionsTable.tsx`  
`modules/admin/ui/components/finance/ReconciliationTable.tsx`  
`app/(public)/coletores/verificar-email/VerificarEmailClient.tsx`  
`modules/admin/ui/components/finance/Reports.tsx`  
`modules/admin/ui/components/finance/ExpensesTable.tsx`  
`modules/admin/ui/components/finance/AccountsPayableTable.tsx`  
`modules/admin/ui/components/finance/PayoutsTable.tsx`  
`modules/admin/ui/components/finance/WalletTransactionsTable.tsx`  
`app/(public)/coletores/suporte/SuporteClient.tsx`  
`modules/admin/ui/components/finance/CarrierPayoutsTable.tsx`  
`modules/admin/ui/components/finance/LedgerTable.tsx`  
`modules/admin/ui/components/finance/DRETable.tsx`  
`modules/admin/ui/components/finance/ProfileCommissionsTable.tsx`  
`modules/admin/ui/components/SupportQuickView.tsx`  
`app/(public)/coletores/login/LoginColetorClient.tsx`  
`app/(collector)/collector/login/LoginCollectorClient.tsx`  
`modules/admin/ui/components/users/UsersTable.tsx`  
`app/(admin)/admin/logout/LogoutClient.tsx`  
`modules/admin/ui/components/users/UserDrawer.tsx`  
`modules/admin/ui/components/users/RolesChecklist.tsx`  
`modules/admin/ui/components/PendingPickupPointShipments.tsx`  
`app/(public)/coletores/cadastro/CadastroClient.tsx`  
`modules/admin/ui/components/ShipmentsSummaryCard.tsx`  
`app/(collector)/collector/receptions/ReceptionsClient.tsx`  
`app/(public)/coletores/ColetoresDashClient.tsx`  
`modules/admin/ui/components/clients/AdminClientCards.tsx`  
`modules/admin/ui/components/clients/ClientsTable.tsx`  
`app/(collector)/collector/CollectorDashClient.tsx`  
`modules/admin/ui/components/clients/AdminClientWallet.tsx`  
`app/(admin)/admin/pontos-de-coleta/[id]/AdminPickupPointDetailsClient.tsx`  
`modules/admin/ui/components/clients/ClientDrawer.tsx`  
`modules/admin/ui/components/clients/AdminClientRecurringItems.tsx`  
`app/(admin)/admin/pontos-de-coleta/PickupPointsClient.tsx`  
`modules/admin/ui/components/clients/AdminClientsPage.tsx`  
`modules/admin/ui/components/clients/AdminClientRecipients.tsx`  
`app/(collector)/collector/support/SupportClient.tsx`  
`modules/admin/ui/components/clients/AdminClientAddresses.tsx`  
`app/(public)/coletores/coletas/ColetasColetorClient.tsx`  
`modules/admin/ui/components/clients/AdminClientProfile.tsx`  
`app/(admin)/admin/correios/CorreiosClient.tsx`  
`modules/admin/ui/components/collectors/CollectorPickupsTab.tsx`  
`modules/admin/ui/components/QuickCalculator.tsx`  
`modules/admin/ui/components/PaymentGatewayConfig.tsx`  
`app/(collector)/collector/support/novo/NovoSupportClient.tsx`  
`modules/admin/ui/components/EmailConfigForm.tsx`  
`app/(public)/coletores/coletas-realizadas/ColetasRealizadasClient.tsx`  
`modules/admin/ui/components/PickupSchedule.tsx`  
`modules/admin/ui/components/QuickActions.tsx`  
`modules/admin/ui/components/KpiCards.tsx`  
`app/(admin)/admin/financeiro/repasses/RepassesClient.tsx`  
`modules/admin/ui/components/ShipmentsStatusBoard.tsx`  
`modules/admin/ui/components/PendingPaymentsGrid.tsx`  
`shared/ui/ELAlert.tsx`  
`modules/admin/ui/components/pickup-points/PickupPointReceptionsTab.tsx`  
`shared/ui/RecurringItemAutocomplete.tsx`  
`app/(public)/coletor/redefinir-senha/RedefinirSenhaClient.tsx`  
`app/(admin)/admin/financeiro/relatorios/RelatoriosClient.tsx`  
`modules/admin/ui/components/ops/ShipmentsTable.tsx`  
`modules/admin/ui/components/ops/ReceptionsTable.tsx`  
`modules/admin/ui/components/ops/ExceptionsTable.tsx`  
`modules/admin/ui/components/ops/EventsTable.tsx`  
`app/(admin)/admin/financeiro/comissoes/ComissoesFinanceiroClient.tsx`  
`modules/admin/ui/components/ops/ShipmentDetailDrawer.tsx`  
`app/(public)/pagar/[token]/PaymentPageClient.tsx`  
`modules/admin/ui/components/ops/PickupsTable.tsx`  
`modules/admin/ui/components/ops/PoCTable.tsx`  
`app/(admin)/admin/financeiro/movimentacoes/MovimentacoesClient.tsx`  
`modules/admin/ui/components/WalletCard.tsx`  
`modules/admin/ui/components/WalletRecent.tsx`  
`app/(admin)/admin/financeiro/despesas/DespesasClient.tsx`  
`shared/ui/AppContainer.tsx`  
`app/(auth)/auth/forgot-password/ForgotPasswordClient.tsx`  
`shared/ui/ELStatusTag.tsx`  
`app/(admin)/admin/contas/[id]/AdminClientDetailsClient.tsx`  
`shared/ui/ELDrawer.tsx`  
`shared/ui/EntitySearchFilters.tsx`  
`app/(auth)/auth/verify-email/VerifyEmailClient.tsx`  
`shared/ui/PasswordStrength.tsx`  
`app/(auth)/auth/reset-password/ResetPasswordForm.tsx`  
`app/(admin)/admin/coletores/[id]/CollectorDetailClient.tsx`  
`shared/ui/CepInput.tsx`  
`app/(admin)/admin/coletores/ColetoresClient.tsx`  
`app/(auth)/auth/reset-password/ResetPasswordClient.tsx`  
`app/(admin)/admin/gateway-pagamento/PaymentGatewayClient.tsx`  
`app/(auth)/auth/login/LoginClient.tsx`  
`app/(admin)/admin/suporte/[id]/AdminSupportTicketClient.tsx`  
`app/(auth)/auth/cadastro/CadastroClient.tsx`  
`modules/cart/ui/components/CartSummary.tsx`  
`app/(admin)/admin/suporte/SuporteAdminClient.tsx`  
`app/(auth)/auth/confirmacao/ConfirmacaoClient.tsx`  
`shared/ui/DataTable.tsx`  
`app/(admin)/admin/config/knowledge-base/KnowledgeBaseClient.tsx`  
`shared/ui/ELModal.tsx`  
`modules/pickup-points/ui/components/PickupShipmentsTable.tsx`  
`app/(admin)/admin/config/openrouter/OpenRouterClient.tsx`  
`modules/wallet/ui/components/BalanceCard.tsx`  
`modules/payments/ui/components/RecipientPaymentModal.tsx`  
`modules/pickup-points/ui/components/PickupTimeline.tsx`  
`modules/payments/ui/components/MercadoPagoSecurity.tsx`  
`modules/wallet/ui/components/CardPaymentForm.tsx`  
`modules/pickup-points/ui/components/PickupSummary.tsx`  
`modules/wallet/ui/components/ResolveDebtModal.tsx`  
`shared/ui/layout/MobileDrawer.tsx`  
`modules/payments/ui/components/RecipientCardPaymentForm.tsx`  
`modules/wallet/ui/components/AddFundsModal.tsx`  
`app/(admin)/admin/config/google-oauth/GoogleOAuthClient.tsx`  
`modules/payments/ui/components/PixPaymentView.tsx`  
`modules/wallet/ui/components/MonthlySummaryCard.tsx`  
`shared/ui/layout/dashboard-shell.tsx`  
`modules/wallet/ui/components/PaymentMethodCard.tsx`  
`modules/pickup-points/ui/components/forms/EnderecoForm.tsx`  
`modules/wallet/ui/components/TransactionsTable.tsx`  
`modules/payments/ui/components/CheckoutModal.tsx`  
`modules/wallet/ui/components/StatementTable.tsx`  
`shared/ui/layout/Sidebar.tsx`  
`modules/wallet/ui/components/PeriodSummaryCard.tsx`  
`modules/pickup-points/ui/components/forms/PJForm.tsx`  
`modules/payments/ui/components/CheckoutCartModal.tsx`  
`modules/wallet/ui/components/SavedCardPaymentForm.tsx`  
`modules/wallet/ui/components/StatementPDFModal.tsx`  
`shared/ui/layout/UserPanel.tsx`  
`modules/pickup-points/ui/components/PickupWizard.tsx`  
`modules/pickup-points/ui/components/PointsTable.tsx`  
`modules/pickup-points/ui/components/PickupStatusTag.tsx`  
`modules/pickup-points/ui/components/PointDrawer.tsx`  
`app/(admin)/admin/config/comissoes/ComissoesClient.tsx`  
`modules/payments/ui/components/PaidCheckoutModal.tsx`  
`shared/ui/ActionBar.tsx`  
`modules/pickup-points/ui/components/forms/PagamentoForm.tsx`  
`shared/ui/FormCard.tsx`  
`modules/payments/ui/components/PaymentMethodSelector.tsx`  
`modules/payments/ui/components/CardPaymentView.tsx`  
`modules/payments/ui/components/PaymentModal.tsx`  
`modules/recipients/ui/components/RecipientModal.tsx`  
`modules/recipients/ui/components/RecipientSelect.tsx`  
`app/(admin)/admin/config/correios-agencies/CorreiosAgenciesClient.tsx`  
`app/(admin)/admin/config/AdminConfigClient.tsx`  
`modules/tracking/ui/components/TrackingStatusTag.tsx`  
`app/(admin)/admin/login/AdminLoginClient.tsx`  
`modules/tracking/ui/components/PublicShipmentItems.tsx`  
`modules/labels/ui/components/EtiquetaGenerica.tsx`  
`modules/tracking/ui/components/TrackingTimeline.tsx`  
`modules/collectors/ui/components/forms/VehicleForm.tsx`  
`modules/shipments/ui/components/shipments-table.tsx`  
`modules/quotes/ui/components/ResultsBanner.tsx`  
`modules/collectors/ui/components/forms/PJForm.tsx`  
`modules/quotes/ui/components/VolumesGrid.tsx`  
`modules/shipments/ui/components/shipment-status-badge.tsx`  
`modules/collectors/ui/components/forms/BankForm.tsx`  
`modules/labels/ui/components/LabelsTable.tsx`  
`modules/quotes/ui/components/UnitsMap.tsx`  
`modules/quotes/ui/components/ContentDeclarationModal.tsx`  
`modules/collectors/ui/components/forms/FinanceForm.tsx`  
`modules/labels/ui/components/ShipmentLabelModal.tsx`  
`modules/coletas/ui/components/ColetaDetailDrawer.tsx`  
`modules/collectors/ui/components/forms/DocumentsForm.tsx`  
`modules/quotes/ui/components/ReverseToggle.tsx`  
`modules/quotes/ui/components/RecipientForm.tsx`  
`modules/labels/ui/components/EtiquetaCorreios.tsx`  
`modules/collectors/ui/components/forms/PFForm.tsx`  
`modules/coletas/ui/components/ColetasTable.tsx`  
`modules/quotes/ui/components/VolumeDeclarationTab.tsx`  
`modules/quotes/ui/components/InvoiceItemsTable.tsx`  
`modules/collectors/ui/components/DocsStatusBadge.tsx`  
`modules/quotes/ui/components/ModalNovaEmbalagem.tsx`  
`app/(admin)/admin/servidor-email/EmailServerClient.tsx`  
`modules/quotes/ui/components/RecurringItemAutocompleteInput.tsx`  
`modules/collectors/ui/components/CollectorsTable.tsx`  
`modules/labels/ui/components/ShipmentLabelPdfModal.tsx`  
`modules/quotes/ui/components/PickupToggle.tsx`  
`modules/auth/ui/components/SecurityForm.tsx`  
`modules/quotes/ui/components/VolumeNFeTab.tsx`  
`modules/support/ui/components/TicketStatusTag.tsx`  
`modules/collectors/ui/components/CollectorDrawer.tsx`  
`modules/labels/ui/components/LabelModal.tsx`  
`modules/quotes/ui/components/NFeGridPerPackage.tsx`  
`modules/auth/ui/components/CardModal.tsx`  
`modules/quotes/ui/components/DeclarationItems.tsx`  
`modules/support/ui/components/CannedReplySelect.tsx`  
`modules/labels/ui/components/LabelRenderer.tsx`  
`modules/quotes/ui/components/QuoteResultCard.tsx`  
`modules/quotes/ui/components/LeafletMapInner.tsx`  
`modules/auth/ui/components/RecurringItemsList.tsx`  
`modules/support/ui/components/SupportFAQ.tsx`  
`modules/labels/ui/components/LabelPrintModal.tsx`  
`modules/quotes/ui/components/DocumentChooser.tsx`  
`app/(admin)/admin/operacoes/OperacoesClient.tsx`  
`modules/auth/ui/components/CardsList.tsx`  
`modules/support/ui/components/TicketCommentBox.tsx`  
`modules/quotes/ui/components/InsuranceInput.tsx`  
`modules/quotes/ui/components/CepField.tsx`  
`modules/auth/ui/components/AccountTabs.tsx`  
`modules/quotes/ui/components/VolumesTotalizer.tsx`  
`modules/support/ui/components/TicketDetailsDrawer.tsx`  
`modules/quotes/ui/components/NFeGrid.tsx`  
`modules/auth/ui/components/AddressModal.tsx`  
`modules/support/ui/components/NewTicketList.tsx`  
`app/(admin)/admin/AdminDashboardClient.tsx`  
`modules/quotes/ui/components/QuoteNavigationButtons.tsx`  
`modules/quotes/ui/components/LabelPreview.tsx`  
`modules/auth/ui/components/AdminGuard.tsx`  
`modules/support/ui/components/SupportForm.tsx`  
`modules/quotes/ui/components/PartnerPoints.tsx`  
`modules/quotes/ui/components/QuoteResultsSection.tsx`  
`modules/quotes/ui/components/PostingUnitPicker.tsx`  
`modules/auth/ui/components/PersonalForm.tsx`  
`modules/quotes/ui/components/VolumeDocuments.tsx`  
`modules/support/ui/components/CollectorSupportForm.tsx`  
`modules/quotes/ui/components/MinhasEmbalagensSelect.tsx`  
`modules/quotes/ui/components/QuoteSummary.tsx`  
`modules/auth/ui/components/AddressesList.tsx`  
`modules/quotes/ui/components/VolumeDeclarationItems.tsx`  
`modules/quotes/ui/components/MapModal.tsx`  
`modules/quotes/ui/components/ResultsTable.tsx`  
`modules/quotes/ui/components/DestinationModeSelector.tsx`  
`modules/auth/ui/components/SessionIdleModal.tsx`  
`modules/quotes/ui/components/PackageNFeRow.tsx`  
`app/(admin)/admin/usuarios/AdminUsersClient.tsx`  
`modules/quotes/ui/components/RecipientModal.tsx`  
`modules/quotes/ui/components/QuoteForm.tsx`  
`modules/auth/ui/components/AddressSelect.tsx`  
`modules/auth/ui/components/RecipientsList.tsx`  
`app/rastreio/[code]/PublicTrackingClient.tsx`  
`app/(envio)/coletas/ColetasClient.tsx`  
`modules/assistant/ui/components/AssistantChat.tsx`  
`app/(envio)/pagamentos-pendentes/RecipientPaymentsClient.tsx`  
`app/(envio)/shipments/ShipmentsClient.tsx`  
`app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`  
`app/(envio)/coletas/nova/NovaColetaClient.tsx`  
`app/(envio)/(overview)/OverviewClient.tsx`  
`app/(envio)/coletas/[id]/PickupDetailClient.tsx`  
`app/(envio)/carrinho/CarrinhoClient.tsx`  
`app/(envio)/etiquetas/EtiquetasClient.tsx`  
`app/(envio)/rastreamento/RastreamentoClient.tsx`  
`app/(envio)/carteira/CarteiraClient.tsx`  
`app/(envio)/cotacoes/CotacoesClient.tsx`  
`app/(envio)/minha-conta/MinhaContaClient.tsx`  
`app/(envio)/carteira/metodos/MetodosClient.tsx`  
`app/(envio)/rastreamento/[id]/RastreamentoDetailClient.tsx`  
`app/(envio)/carteira/faturas/FaturasClient.tsx`  
`app/(envio)/carteira/extrato/ExtratoClient.tsx`  
`app/(envio)/suporte/novo/NovoSuporteClient.tsx`  
`app/(envio)/suporte/SuporteClient.tsx`  
`app/(envio)/cotacoes/finalizar/FinalizarClient.tsx`  
`app/(envio)/suporte/[id]/TicketDetailClient.tsx`

#### D) Outros
`app/(public)/coletores/ColetoresLayoutClient.tsx`  
`app/(public)/coletores/ClientWrapper.tsx`  
`app/(collector)/error.tsx`  
`shared/hooks/useCepLookup.ts`  
`app/(public)/coletores/verificar-email/ClientWrapper.tsx`  
`app/coletores/error.tsx`  
`app/(collector)/collector/ClientWrapper.tsx`  
`app/(public)/coletores/suporte/ClientWrapper.tsx`  
`app/(collector)/collector/login/ClientWrapper.tsx`  
`app/(public)/coletores/login/ClientWrapper.tsx`  
`app/(collector)/collector/LayoutWrapper.tsx`  
`app/(admin)/admin/logout/ClientWrapper.tsx`  
`app/(admin)/admin/ClientWrapper.tsx`  
`app/(public)/coletores/cadastro/ClientWrapper.tsx`  
`app/(collector)/collector/receptions/ClientWrapper.tsx`  
`app/(admin)/admin/pontos-de-coleta/ClientWrapper.tsx`  
`app/(public)/coletores/LayoutWrapper.tsx`  
`app/(public)/coletores/error.tsx`  
`app/(collector)/collector/CollectorLayoutClient.tsx`  
`app/(admin)/admin/pontos-de-coleta/[id]/ClientWrapper.tsx`  
`app/(public)/coletores/coletas/ClientWrapper.tsx`  
`app/(collector)/collector/support/ClientWrapper.tsx`  
`app/(admin)/admin/correios/ClientWrapper.tsx`  
`app/(collector)/collector/support/novo/ClientWrapper.tsx`  
`app/(public)/coletores/coletas-realizadas/ClientWrapper.tsx`  
`app/(admin)/admin/financeiro/repasses/ClientWrapper.tsx`  
`app/(public)/coletor/redefinir-senha/ClientWrapper.tsx`  
`app/(admin)/admin/financeiro/relatorios/ClientWrapper.tsx`  
`app/(admin)/admin/financeiro/comissoes/ClientWrapper.tsx`  
`app/(admin)/admin/financeiro/movimentacoes/ClientWrapper.tsx`  
`app/(admin)/admin/financeiro/despesas/ClientWrapper.tsx`  
`app/(auth)/auth/forgot-password/ClientWrapper.tsx`  
`app/(admin)/admin/contas/[id]/ClientWrapper.tsx`  
`app/(auth)/auth/verify-email/ClientWrapper.tsx`  
`app/(admin)/admin/coletores/ClientWrapper.tsx`  
`app/(admin)/admin/coletores/[id]/ClientWrapper.tsx`  
`app/(auth)/auth/reset-password/ClientWrapper.tsx`  
`app/(admin)/admin/gateway-pagamento/ClientWrapper.tsx`  
`app/(auth)/auth/login/ClientWrapper.tsx`  
`app/(admin)/admin/suporte/ClientWrapper.tsx`  
`app/(auth)/auth/cadastro/ClientWrapper.tsx`  
`app/(admin)/admin/suporte/[id]/ClientWrapper.tsx`  
`app/(auth)/auth/confirmacao/ClientWrapper.tsx`  
`app/(auth)/LayoutWrapper.tsx`  
`app/(admin)/admin/config/ClientWrapper.tsx`  
`app/(auth)/AuthLayoutClient.tsx`  
`app/(admin)/admin/config/knowledge-base/ClientWrapper.tsx`  
`app/(admin)/admin/config/openrouter/ClientWrapper.tsx`  
`modules/payments/ui/components/usePixPayment.ts`  
`app/(admin)/admin/config/google-oauth/ClientWrapper.tsx`  
`modules/wallet/ui/hooks/useWalletStatus.ts`  
`app/(admin)/admin/config/comissoes/ClientWrapper.tsx`  
`app/(admin)/admin/config/correios-agencies/ClientWrapper.tsx`  
`modules/recipients/ui/state/recipients.ts`  
`app/(admin)/admin/login/ClientWrapper.tsx`  
`app/(admin)/admin/servidor-email/ClientWrapper.tsx`  
`modules/coletas/ui/state/useColetasStore.ts`  
`app/(admin)/admin/operacoes/ClientWrapper.tsx`  
`modules/quotes/ui/state/quoteDraft.ts`  
`app/(admin)/admin/error.tsx`  
`modules/auth/ui/state/addresses.ts`  
`app/(admin)/admin/usuarios/ClientWrapper.tsx`  
`modules/support/ui/hooks/useSupport.ts`  
`app/error.tsx`  
`app/rastreio/[code]/ClientWrapper.tsx`  
`app/rastreio/error.tsx`  
`modules/auth/ui/hooks/useCurrentUser.ts`  
`modules/auth/application/roles.ts`  
`app/(envio)/shipments/ClientWrapper.tsx`  
`app/(envio)/coletas/ClientWrapper.tsx`  
`app/(envio)/pagamentos-pendentes/ClientWrapper.tsx`  
`app/(envio)/shipments/[id]/ClientWrapper.tsx`  
`app/(envio)/(overview)/ClientWrapper.tsx`  
`app/(envio)/coletas/nova/ClientWrapper.tsx`  
`app/(envio)/coletas/[id]/ClientWrapper.tsx`  
`app/(envio)/error.tsx`  
`app/(envio)/EnvioLayoutClient.tsx`  
`app/(envio)/etiquetas/ClientWrapper.tsx`  
`app/(envio)/LayoutWrapper.tsx`  
`app/(envio)/suporte/ClientWrapper.tsx`  
`app/(envio)/carrinho/ClientWrapper.tsx`  
`app/(envio)/minha-conta/ClientWrapper.tsx`  
`app/(envio)/rastreamento/ClientWrapper.tsx`  
`app/(envio)/carteira/error.tsx`  
`app/(envio)/cotar/error.tsx`  
`app/(envio)/cotacoes/ClientWrapper.tsx`  
`app/(envio)/carteira/ClientWrapper.tsx`  
`app/(envio)/carteira/metodos/ClientWrapper.tsx`  
`app/(envio)/carteira/faturas/ClientWrapper.tsx`  
`app/(envio)/rastreamento/[id]/ClientWrapper.tsx`  
`app/(envio)/suporte/[id]/ClientWrapper.tsx`  
`app/(envio)/suporte/novo/ClientWrapper.tsx`  
`app/(envio)/carteira/extrato/ClientWrapper.tsx`  
`app/(envio)/cotacoes/finalizar/ClientWrapper.tsx`  
`app/(admin)/admin/suporte/page.tsx.backup`  
`app/(envio)/suporte/page.tsx.backup`

### Lista de modulos recomendados para `server-only`
`platform/db/db.ts`  
`platform/db/database.ts`  
`platform/db/env-validation.ts`  
`platform/cache/redis.ts`  
`platform/cache/rate-limit-redis.ts`  
`platform/crypto/card-vault.ts`  
`platform/integrations/mercadopago/config.ts`  
`platform/integrations/mercadopago/payments.ts`  
`platform/integrations/correios/client.ts`  
`platform/integrations/correios/precoPrazo.ts`  
`platform/storage/collector-documents.ts`  
`platform/storage/expense-receipts.ts`  
`platform/storage/support-attachments.ts`  
`modules/cart/application/checkout.service.ts`  
`modules/auth/application/jwt-tokens.ts`  
`modules/auth/application/admin-session.ts`  
`modules/auth/application/collector-session.ts`  
`modules/shipments/application/create-paid-shipment.service.ts`  
`modules/labels/application/list.service.ts`  
`modules/tracking/application/create-event.ts`

### Lista de modulos recomendados para `client-only`
`shared/utils/pdf.ts`  
`modules/labels/infra/document-pdf.ts`  
`modules/labels/application/cache.ts`  
`platform/integrations/correios/barcode-generator.ts`  
`modules/cart/ui/state/useCheckoutStore.ts`  
`modules/quotes/ui/state/useQuoteStore.ts`  
`modules/pickup-points/ui/state/usePickupPointsStore.ts`  
`modules/quotes/ui/components/quoteFormHelpers.ts`  
`shared/hooks/useFipeVehicles.ts`  
`modules/collectors/ui/hooks/useFipeVehicles.ts`  
`modules/shipments/ui/hooks/useRecurringItemsAutocomplete.ts`  
`modules/shipments/ui/hooks/useInvoiceItems.ts`  
`modules/pickup-points/ui/hooks/usePickupPointsAPI.ts`  
`modules/account/ui/hooks/useAccount.ts`  
`modules/auth/ui/hooks/useAccount.ts`

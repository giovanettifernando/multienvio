#!/usr/bin/env npx ts-node
/**
 * Cria arquivos de re-export para componentes com default export
 * Necessário para barrels funcionarem com imports default
 */

import * as fs from 'fs';
import * as path from 'path';

// Mapa de componentes que precisam de re-export
// Formato: [caminho legado] => [caminho do módulo]
const REEXPORTS: Record<string, string> = {
  // Wallet
  'components/wallet/BalanceCard': 'modules/wallet/ui/components/BalanceCard',
  'components/wallet/MonthlySummaryCard': 'modules/wallet/ui/components/MonthlySummaryCard',
  'components/wallet/AddFundsModal': 'modules/wallet/ui/components/AddFundsModal',
  'components/wallet/ResolveDebtModal': 'modules/wallet/ui/components/ResolveDebtModal',
  'components/wallet/TransactionsTable': 'modules/wallet/ui/components/TransactionsTable',
  'components/wallet/PeriodSummaryCard': 'modules/wallet/ui/components/PeriodSummaryCard',
  'components/wallet/StatementTable': 'modules/wallet/ui/components/StatementTable',
  'components/wallet/StatementPDFModal': 'modules/wallet/ui/components/StatementPDFModal',

  // Collectors
  'components/collectors/CollectorsTable': 'modules/collectors/ui/components/CollectorsTable',
  'components/collectors/CollectorDrawer': 'modules/collectors/ui/components/CollectorDrawer',
  'components/collectors/forms/PFForm': 'modules/collectors/ui/components/forms/PFForm',
  'components/collectors/forms/PJForm': 'modules/collectors/ui/components/forms/PJForm',
  'components/collectors/forms/VehicleForm': 'modules/collectors/ui/components/forms/VehicleForm',
  'components/collectors/forms/DocumentsForm': 'modules/collectors/ui/components/forms/DocumentsForm',
  'components/collectors/forms/FinanceForm': 'modules/collectors/ui/components/forms/FinanceForm',

  // Pickup
  'components/pickup/PointsTable': 'modules/pickup-points/ui/components/PointsTable',
  'components/pickup/PointDrawer': 'modules/pickup-points/ui/components/PointDrawer',

  // Admin
  'components/admin/PaymentGatewayConfig': 'modules/admin/ui/components/PaymentGatewayConfig',
  'components/admin/PendingPaymentsGrid': 'modules/admin/ui/components/PendingPaymentsGrid',
  'components/admin/EmailConfigForm': 'modules/admin/ui/components/EmailConfigForm',
  'components/admin/ops/ShipmentsTable': 'modules/admin/ui/components/ops/ShipmentsTable',
  'components/admin/ops/PickupsTable': 'modules/admin/ui/components/ops/PickupsTable',
  'components/admin/ops/ReceptionsTable': 'modules/admin/ui/components/ops/ReceptionsTable',
  'components/admin/ops/ExceptionsTable': 'modules/admin/ui/components/ops/ExceptionsTable',
  'components/admin/ops/EventsTable': 'modules/admin/ui/components/ops/EventsTable',
  'components/admin/clients/AdminClientProfile': 'modules/admin/ui/components/clients/AdminClientProfile',
  'components/admin/clients/AdminClientAddresses': 'modules/admin/ui/components/clients/AdminClientAddresses',
  'components/admin/clients/AdminClientCards': 'modules/admin/ui/components/clients/AdminClientCards',
  'components/admin/clients/AdminClientRecipients': 'modules/admin/ui/components/clients/AdminClientRecipients',
  'components/admin/clients/AdminClientRecurringItems': 'modules/admin/ui/components/clients/AdminClientRecurringItems',
  'components/admin/clients/AdminClientWallet': 'modules/admin/ui/components/clients/AdminClientWallet',
  'components/admin/collectors/CollectorPickupsTab': 'modules/admin/ui/components/collectors/CollectorPickupsTab',
  'components/admin/pickup-points/PickupPointReceptionsTab': 'modules/admin/ui/components/pickup-points/PickupPointReceptionsTab',

  // Shared
  'components/shared/EntitySearchFilters': 'shared/ui/EntitySearchFilters',

  // Coletas
  'components/coletas/ColetasTable': 'modules/coletas/ui/components/ColetasTable',

  // Labels
  'components/labels/LabelsTable': 'modules/labels/ui/components/LabelsTable',
  'components/labels/LabelPrintModal': 'modules/labels/ui/components/LabelPrintModal',

  // Cart
  'components/cart/CartTable': 'modules/cart/ui/components/CartTable',
  'components/cart/CartItemDrawer': 'modules/cart/ui/components/CartItemDrawer',

  // Support
  'components/support/SupportForm': 'modules/support/ui/components/SupportForm',
  'components/support/TicketDetailsDrawer': 'modules/support/ui/components/TicketDetailsDrawer',
  'components/support/TicketCommentBox': 'modules/support/ui/components/TicketCommentBox',

  // Quote
  'components/quote/QuoteForm': 'modules/quotes/ui/components/QuoteForm',
  'components/quote/QuoteResultsSection': 'modules/quotes/ui/components/QuoteResultsSection',
  'components/quote/QuoteResultCard': 'modules/quotes/ui/components/QuoteResultCard',
  'components/quote/VolumesGrid': 'modules/quotes/ui/components/VolumesGrid',
};

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createReexport(legacyPath: string, modulePath: string) {
  const fullLegacyPath = path.join(process.cwd(), `${legacyPath}.ts`);

  // Pular se já existe
  if (fs.existsSync(fullLegacyPath)) {
    console.log(`⏭️  Skip: ${legacyPath}.ts já existe`);
    return false;
  }

  // Verificar se o módulo fonte existe
  const fullModulePath = path.join(process.cwd(), `${modulePath}.tsx`);
  const fullModulePathTs = path.join(process.cwd(), `${modulePath}.ts`);

  if (!fs.existsSync(fullModulePath) && !fs.existsSync(fullModulePathTs)) {
    console.log(`⚠️  Warn: Módulo não encontrado: ${modulePath}`);
    return false;
  }

  ensureDir(fullLegacyPath);

  const content = `// Re-export com default export
export { default } from '@/${modulePath}';
export * from '@/${modulePath}';
`;

  fs.writeFileSync(fullLegacyPath, content, 'utf-8');
  console.log(`✅ Created: ${legacyPath}.ts`);
  return true;
}

function main() {
  console.log('🔄 Criando arquivos de re-export...\n');

  let created = 0;
  let skipped = 0;
  let warnings = 0;

  for (const [legacyPath, modulePath] of Object.entries(REEXPORTS)) {
    const result = createReexport(legacyPath, modulePath);
    if (result) created++;
    else if (fs.existsSync(path.join(process.cwd(), `${legacyPath}.ts`))) skipped++;
    else warnings++;
  }

  console.log('\n📊 Resumo:');
  console.log(`   Criados: ${created}`);
  console.log(`   Existentes: ${skipped}`);
  console.log(`   Avisos: ${warnings}`);
}

main();

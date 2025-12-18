/**
 * Codemod para migrar imports legados para a nova estrutura
 *
 * Migra:
 * - @/lib/validation/X → @/shared/validation/X
 * - @/components/ui/X → @/shared/ui/X
 * - @/components/feature/X → @/modules/feature/ui/components/X
 * - @/types/X → @/shared/types/X
 * - @/store/X e @/stores/X → @/modules/feature/ui/state/X
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Mapeamentos específicos de imports
const IMPORT_MAPPINGS: Record<string, string> = {
  // ============================================================================
  // @/lib/validation/* → @/shared/validation/*
  // ============================================================================
  '@/lib/validation/address': '@/shared/validation/address',
  '@/lib/validation/admin-auth': '@/shared/validation/admin-auth',
  '@/lib/validation/auth': '@/shared/validation/auth',
  '@/lib/validation/billing': '@/shared/validation/billing',
  '@/lib/validation/card': '@/shared/validation/card',
  '@/lib/validation/cart': '@/shared/validation/cart',
  '@/lib/validation/company': '@/shared/validation/company',
  '@/lib/validation/integrations-payments': '@/shared/validation/integrations-payments',
  '@/lib/validation/order': '@/shared/validation/order',
  '@/lib/validation/packaging': '@/shared/validation/packaging',
  '@/lib/validation/password-policy': '@/shared/validation/password-policy',
  '@/lib/validation/pickup': '@/shared/validation/pickup',
  '@/lib/validation/profile': '@/shared/validation/profile',
  '@/lib/validation/quote': '@/shared/validation/quote',
  '@/lib/validation/quote-backend': '@/shared/validation/quote-backend',
  '@/lib/validation/recipient': '@/shared/validation/recipient',
  '@/lib/validation/shipment': '@/shared/validation/shipment',
  '@/lib/validation/support': '@/shared/validation/support',
  '@/lib/validation/utils': '@/shared/validation/utils',
  '@/lib/validation/validators': '@/shared/validation/validators',
  '@/lib/validation/wallet': '@/shared/validation/wallet',

  // ============================================================================
  // @/lib/* outros → @/platform/* ou @/shared/*
  // ============================================================================
  '@/lib/logger': '@/platform/logging/logger',
  '@/lib/db': '@/platform/db/db',
  '@/lib/cache': '@/platform/cache/cache',
  '@/lib/redis': '@/platform/cache/redis',
  '@/lib/masks': '@/shared/utils/masks',

  // ============================================================================
  // @/lib/api/* → @/platform/api/*
  // ============================================================================
  '@/lib/api/errors': '@/platform/api/errors',
  '@/lib/api/handler': '@/platform/api/handler',
  '@/lib/api/response': '@/platform/api/response',
  '@/lib/api/runtime': '@/platform/api/runtime',
  '@/lib/api/client': '@/platform/api/client',
  '@/lib/api/csrf': '@/platform/api/csrf',
  '@/lib/api/labels': '@/platform/api/labels',
  '@/lib/api/logger': '@/platform/api/logger',
  '@/lib/api/rate-limit': '@/platform/api/rate-limit',
  '@/lib/api/stores': '@/platform/api/stores',
  '@/lib/api/types': '@/platform/api/types',

  // ============================================================================
  // @/lib/auth/* → @/modules/auth/application/*
  // ============================================================================
  '@/lib/auth/session': '@/modules/auth/application/session',
  '@/lib/auth/user-session': '@/modules/auth/application/user-session',
  '@/lib/auth/tokens': '@/modules/auth/application/tokens',
  '@/lib/auth/jwt-tokens': '@/modules/auth/application/jwt-tokens',
  '@/lib/auth/permissions': '@/modules/auth/application/permissions',
  '@/lib/auth/roles': '@/modules/auth/application/roles',
  '@/lib/auth/route-protection': '@/modules/auth/application/route-protection',
  '@/lib/auth/admin-session': '@/modules/auth/application/admin-session',
  '@/lib/auth/admin-helpers': '@/modules/auth/application/admin-helpers',
  '@/lib/auth/collector-session': '@/modules/auth/application/collector-session',
  '@/lib/auth/autonomous-collector-session': '@/modules/auth/application/autonomous-collector-session',
  '@/lib/auth/google-oauth': '@/modules/auth/application/google-oauth',
  '@/lib/auth/schemas': '@/modules/auth/application/schemas',
  '@/lib/auth/types': '@/modules/auth/application/types',
  '@/lib/auth/hooks': '@/modules/auth/application/hooks',
  '@/lib/auth/queryKeys': '@/modules/auth/application/queryKeys',

  // ============================================================================
  // @/lib/services/* → @/modules/auth/application/*
  // ============================================================================
  '@/lib/services/account-cards.service': '@/modules/auth/application/account-cards.service',
  '@/lib/services/account-recipients.service': '@/modules/auth/application/account-recipients.service',
  '@/lib/services/account-security.service': '@/modules/auth/application/account-security.service',

  // ============================================================================
  // @/lib/shipments/* → @/modules/shipments/application/*
  // ============================================================================
  '@/lib/shipments/shipment-status': '@/modules/shipments/application/shipment-status',
  '@/lib/shipments/status-migration': '@/modules/shipments/application/status-migration',
  '@/lib/shipments/status-labels-map': '@/modules/shipments/application/status-labels-map',
  '@/lib/shipments/public-tracking-status': '@/modules/shipments/application/public-tracking-status',
  '@/lib/shipments/create-with-volumes': '@/modules/shipments/application/create-with-volumes',
  '@/lib/shipments/carrier-events-handler': '@/modules/shipments/application/carrier-events-handler',
  '@/lib/shipments/carrier-integration': '@/modules/shipments/application/carrier-integration',
  '@/lib/shipments/correios-shipment.service': '@/modules/shipments/application/correios-shipment.service',
  '@/lib/shipments/create-paid-shipment.service': '@/modules/shipments/application/create-paid-shipment.service',
  '@/lib/shipments/after-create': '@/modules/shipments/application/after-create',

  // ============================================================================
  // @/lib/pickup/* → @/modules/pickup-points/application/*
  // ============================================================================
  '@/lib/pickup/schemas': '@/modules/pickup-points/application/schemas',
  '@/lib/pickup/types': '@/modules/pickup-points/application/types',
  '@/lib/pickup/masks': '@/modules/pickup-points/application/masks',
  '@/lib/pickup/queryKeys': '@/modules/pickup-points/application/queryKeys',

  // ============================================================================
  // @/lib/utils/* → @/shared/utils/*
  // ============================================================================
  '@/lib/utils/cn': '@/shared/utils/cn',
  '@/lib/utils/geo': '@/shared/utils/geo',
  '@/lib/utils/pdf': '@/shared/utils/pdf',
  '@/lib/utils/string': '@/shared/utils/string',
  '@/lib/utils/swapRouteValues': '@/shared/utils/swapRouteValues',
  '@/lib/utils/card': '@/shared/utils/card',
  '@/lib/utils/format': '@/shared/utils/format',
  '@/lib/utils/packaging': '@/shared/utils/packaging',
  '@/lib/utils/date': '@/shared/utils/date',
  '@/lib/utils/uuid': '@/shared/utils/uuid',
  '@/lib/utils/api-fetch': '@/shared/utils/api-fetch',
  '@/lib/format': '@/shared/utils/format',
  '@/lib/services': '@/shared/utils/services',

  // ============================================================================
  // @/lib/wallet/* → @/modules/wallet/application/*
  // ============================================================================
  '@/lib/wallet/wallet.service': '@/modules/wallet/application/wallet.service',
  '@/lib/wallet/period-summary': '@/modules/wallet/application/period-summary',
  '@/lib/wallet/transaction-direction': '@/modules/wallet/application/transaction-direction',

  // ============================================================================
  // @/lib/labels/* → @/modules/labels/application/*
  // ============================================================================
  '@/lib/labels/cache': '@/modules/labels/application/cache',

  // ============================================================================
  // @/lib/services/* → @/platform/integrations/*
  // ============================================================================
  '@/lib/services/geocoding': '@/platform/integrations/shared/geocoding',

  // ============================================================================
  // @/components/ui/* → @/shared/ui/*
  // ============================================================================
  '@/components/ui/ELAlert': '@/shared/ui/ELAlert',
  '@/components/ui/ELButton': '@/shared/ui/ELButton',
  '@/components/ui/ELCard': '@/shared/ui/ELCard',
  '@/components/ui/ELDrawer': '@/shared/ui/ELDrawer',
  '@/components/ui/ELEmpty': '@/shared/ui/ELEmpty',
  '@/components/ui/ELFormItem': '@/shared/ui/ELFormItem',
  '@/components/ui/ELGrid': '@/shared/ui/ELGrid',
  '@/components/ui/ELInput': '@/shared/ui/ELInput',
  '@/components/ui/ELModal': '@/shared/ui/ELModal',
  '@/components/ui/ELSelect': '@/shared/ui/ELSelect',
  '@/components/ui/ELSkeleton': '@/shared/ui/ELSkeleton',
  '@/components/ui/ELStatusTag': '@/shared/ui/ELStatusTag',
  '@/components/ui/ELTableToolbar': '@/shared/ui/ELTableToolbar',
  '@/components/ui/ELTag': '@/shared/ui/ELTag',
  '@/components/ui/ActionBar': '@/shared/ui/ActionBar',
  '@/components/ui/AppContainer': '@/shared/ui/AppContainer',
  '@/components/ui/DataTable': '@/shared/ui/DataTable',
  '@/components/ui/FormCard': '@/shared/ui/FormCard',

  // ============================================================================
  // @/components/shared/* → @/shared/ui/*
  // ============================================================================
  '@/components/shared/PageShell': '@/shared/ui/PageShell',
  '@/components/shared/SearchFilters': '@/shared/ui/SearchFilters',
  '@/components/shared/EntitySearchFilters': '@/shared/ui/EntitySearchFilters',

  // ============================================================================
  // @/components/<feature>/* → @/modules/<feature>/ui/components/*
  // ============================================================================
  // Admin
  '@/components/admin/ops/ShipmentsTable': '@/modules/admin/ui/components/ops/ShipmentsTable',
  '@/components/admin/ops/PickupsTable': '@/modules/admin/ui/components/ops/PickupsTable',
  '@/components/admin/ops/ReceptionsTable': '@/modules/admin/ui/components/ops/ReceptionsTable',
  '@/components/admin/ops/ExceptionsTable': '@/modules/admin/ui/components/ops/ExceptionsTable',
  '@/components/admin/ops/EventsTable': '@/modules/admin/ui/components/ops/EventsTable',
  '@/components/admin/clients/AdminClientsPage': '@/modules/admin/ui/components/clients/AdminClientsPage',
  '@/components/admin/clients/AdminClientProfile': '@/modules/admin/ui/components/clients/AdminClientProfile',
  '@/components/admin/clients/AdminClientAddresses': '@/modules/admin/ui/components/clients/AdminClientAddresses',
  '@/components/admin/clients/AdminClientCards': '@/modules/admin/ui/components/clients/AdminClientCards',
  '@/components/admin/clients/AdminClientRecipients': '@/modules/admin/ui/components/clients/AdminClientRecipients',
  '@/components/admin/clients/AdminClientRecurringItems': '@/modules/admin/ui/components/clients/AdminClientRecurringItems',
  '@/components/admin/clients/AdminClientWallet': '@/modules/admin/ui/components/clients/AdminClientWallet',
  '@/components/admin/collectors/CollectorPickupsTab': '@/modules/admin/ui/components/collectors/CollectorPickupsTab',
  '@/components/admin/pickup-points/PickupPointReceptionsTab': '@/modules/admin/ui/components/pickup-points/PickupPointReceptionsTab',
  '@/components/admin/users/UsersTable': '@/modules/admin/ui/components/users/UsersTable',
  '@/components/admin/users/UserDrawer': '@/modules/admin/ui/components/users/UserDrawer',
  '@/components/admin/finance/AccountsPayableTable': '@/modules/admin/ui/components/finance/AccountsPayableTable',
  '@/components/admin/finance/CarrierPayoutsTable': '@/modules/admin/ui/components/finance/CarrierPayoutsTable',
  '@/components/admin/finance/ChargebacksTable': '@/modules/admin/ui/components/finance/ChargebacksTable',
  '@/components/admin/finance/CommissionsTable': '@/modules/admin/ui/components/finance/CommissionsTable',
  '@/components/admin/finance/DRETable': '@/modules/admin/ui/components/finance/DRETable',
  '@/components/admin/finance/ExpensesTable': '@/modules/admin/ui/components/finance/ExpensesTable',
  '@/components/admin/finance/InvoicesTable': '@/modules/admin/ui/components/finance/InvoicesTable',
  '@/components/admin/finance/LedgerTable': '@/modules/admin/ui/components/finance/LedgerTable',
  '@/components/admin/finance/PayoutsTable': '@/modules/admin/ui/components/finance/PayoutsTable',
  '@/components/admin/finance/ProfileCommissionsTable': '@/modules/admin/ui/components/finance/ProfileCommissionsTable',
  '@/components/admin/finance/ReconciliationTable': '@/modules/admin/ui/components/finance/ReconciliationTable',
  '@/components/admin/finance/WalletTransactionsTable': '@/modules/admin/ui/components/finance/WalletTransactionsTable',
  '@/components/admin/EmailConfigForm': '@/modules/admin/ui/components/EmailConfigForm',
  '@/components/admin/PaymentGatewayConfig': '@/modules/admin/ui/components/PaymentGatewayConfig',
  '@/components/admin/PendingPaymentsGrid': '@/modules/admin/ui/components/PendingPaymentsGrid',

  // Support
  '@/components/support/SupportForm': '@/modules/support/ui/components/SupportForm',
  '@/components/support/NewTicketList': '@/modules/support/ui/components/NewTicketList',
  '@/components/support/TicketDetailsDrawer': '@/modules/support/ui/components/TicketDetailsDrawer',
  '@/components/support/TicketCommentBox': '@/modules/support/ui/components/TicketCommentBox',

  // Wallet
  '@/components/wallet/AddFundsModal': '@/modules/wallet/ui/components/AddFundsModal',
  '@/components/wallet/BalanceCard': '@/modules/wallet/ui/components/BalanceCard',
  '@/components/wallet/MonthlySummaryCard': '@/modules/wallet/ui/components/MonthlySummaryCard',
  '@/components/wallet/PeriodSummaryCard': '@/modules/wallet/ui/components/PeriodSummaryCard',
  '@/components/wallet/ResolveDebtModal': '@/modules/wallet/ui/components/ResolveDebtModal',
  '@/components/wallet/StatementPDFModal': '@/modules/wallet/ui/components/StatementPDFModal',
  '@/components/wallet/StatementTable': '@/modules/wallet/ui/components/StatementTable',
  '@/components/wallet/TransactionsTable': '@/modules/wallet/ui/components/TransactionsTable',

  // Cart
  '@/components/cart/CartSummary': '@/modules/cart/ui/components/CartSummary',
  '@/components/cart/CartTable': '@/modules/cart/ui/components/CartTable',
  '@/components/cart/EmptyCart': '@/modules/cart/ui/components/EmptyCart',
  '@/components/cart/RemoveItemModal': '@/modules/cart/ui/components/RemoveItemModal',

  // Collectors
  '@/components/collectors/CollectorDrawer': '@/modules/collectors/ui/components/CollectorDrawer',
  '@/components/collectors/CollectorsTable': '@/modules/collectors/ui/components/CollectorsTable',
  '@/components/collectors/forms/BankForm': '@/modules/collectors/ui/components/forms/BankForm',
  '@/components/collectors/forms/DocumentsForm': '@/modules/collectors/ui/components/forms/DocumentsForm',
  '@/components/collectors/forms/FinanceForm': '@/modules/collectors/ui/components/forms/FinanceForm',
  '@/components/collectors/forms/PFForm': '@/modules/collectors/ui/components/forms/PFForm',
  '@/components/collectors/forms/PJForm': '@/modules/collectors/ui/components/forms/PJForm',
  '@/components/collectors/forms/VehicleForm': '@/modules/collectors/ui/components/forms/VehicleForm',

  // Pickup Points
  '@/components/pickup/PointDrawer': '@/modules/pickup-points/ui/components/PointDrawer',
  '@/components/pickup/PointsTable': '@/modules/pickup-points/ui/components/PointsTable',

  // Labels
  '@/components/labels/LabelsTable': '@/modules/labels/ui/components/LabelsTable',
  '@/components/labels/LabelPrintModal': '@/modules/labels/ui/components/LabelPrintModal',

  // Quotes
  '@/components/quote/QuoteForm': '@/modules/quotes/ui/components/QuoteForm',
  '@/components/quote/QuoteResultsSection': '@/modules/quotes/ui/components/QuoteResultsSection',
  '@/components/quote/VolumesGrid': '@/modules/quotes/ui/components/VolumesGrid',
  '@/components/quote/QuoteResultCard': '@/modules/quotes/ui/components/QuoteResultCard',

  // Dashboard
  '@/components/dashboard/PendingPickupPointShipments': '@/modules/dashboard/ui/components/PendingPickupPointShipments',
  '@/components/dashboard/PickupSchedule': '@/modules/dashboard/ui/components/PickupSchedule',
  '@/components/dashboard/QuickCalculator': '@/modules/dashboard/ui/components/QuickCalculator',
  '@/components/dashboard/ShipmentsStatusBoard': '@/modules/dashboard/ui/components/ShipmentsStatusBoard',
  '@/components/dashboard/ShipmentsSummaryCard': '@/modules/dashboard/ui/components/ShipmentsSummaryCard',
  '@/components/dashboard/SupportQuickView': '@/modules/dashboard/ui/components/SupportQuickView',
  '@/components/dashboard/WalletCard': '@/modules/dashboard/ui/components/WalletCard',
  '@/components/dashboard/WalletRecent': '@/modules/dashboard/ui/components/WalletRecent',

  // Form
  '@/components/form/CepInput': '@/shared/ui/form/CepInput',
  '@/components/form/PasswordStrength': '@/shared/ui/form/PasswordStrength',

  // Session
  '@/components/session/SessionIdleModal': '@/modules/auth/ui/components/SessionIdleModal',

  // Layout
  '@/components/layout/dashboard-shell': '@/shared/ui/layout/dashboard-shell',

  // Payments
  '@/components/payments/CheckoutCartModal': '@/modules/payments/ui/components/CheckoutCartModal',

  // Providers
  '@/components/providers/app-providers': '@/shared/ui/providers/app-providers',

  // ============================================================================
  // @/types/* → @/shared/types/*
  // ============================================================================
  '@/types/account': '@/shared/types/account',
  '@/types/address': '@/shared/types/address',
  '@/types/billing': '@/shared/types/billing',
  '@/types/cart': '@/shared/types/cart',
  '@/types/contracts': '@/shared/types/contracts',
  '@/types/correios-label': '@/shared/types/correios-label',
  '@/types/dashboard': '@/shared/types/dashboard',
  '@/types/invoice': '@/shared/types/invoice',
  '@/types/label': '@/shared/types/label',
  '@/types/order': '@/shared/types/order',
  '@/types/pickup': '@/shared/types/pickup',
  '@/types/quote': '@/shared/types/quote',
  '@/types/quoteFinalize': '@/shared/types/quoteFinalize',
  '@/types/shipment': '@/shared/types/shipment',
  '@/types/shipments': '@/shared/types/shipments',
  '@/types/support': '@/shared/types/support',
  '@/types/tracking': '@/shared/types/tracking',
  '@/types/validations': '@/shared/types/validations',
  '@/types/wallet': '@/shared/types/wallet',
  '@/types/wallet-statement': '@/shared/types/wallet-statement',
  '@/types': '@/shared/types',

  // ============================================================================
  // @/store/* e @/stores/* → @/modules/*/ui/state/*
  // ============================================================================
  '@/store/useQuoteStore': '@/modules/quotes/ui/state/useQuoteStore',
  '@/stores/auth': '@/modules/auth/ui/state/auth',
  '@/stores/checkout': '@/modules/cart/ui/state/checkout',
  '@/stores/coletas': '@/modules/pickups/ui/state/coletas',
  '@/stores/pontos': '@/modules/pickup-points/ui/state/pontos',
  '@/stores/useAdminSession': '@/modules/admin/ui/state/useAdminSession',
  '@/stores/useColetorSession': '@/modules/collectors/ui/state/useColetorSession',
  '@/stores/useCollectorSession': '@/modules/collectors/ui/state/useCollectorSession',
};

async function main() {
  // Encontrar todos os arquivos TS/TSX em app/, modules/, shared/, platform/, tests/, scripts/
  const files = await glob('{app,modules,shared,platform,tests,scripts}/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', 'scripts/migrate-legacy-imports.ts'],
  });

  console.log(`Processando ${files.length} arquivos...`);

  let totalFixed = 0;
  let filesModified = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;
    let fixCount = 0;

    // Substituir imports mapeados
    for (const [oldImport, newImport] of Object.entries(IMPORT_MAPPINGS)) {
      // Match import statements
      const patterns = [
        // import X from '@/old/path'
        new RegExp(`from '${escapeRegex(oldImport)}'`, 'g'),
        // import X from "@/old/path"
        new RegExp(`from "${escapeRegex(oldImport)}"`, 'g'),
      ];

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, `from '${newImport}'`);
          modified = true;
          fixCount++;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(file, content);
      filesModified++;
      totalFixed += fixCount;
      console.log(`  ✓ ${file} (${fixCount} imports)`);
    }
  }

  console.log(`\n✅ Migração concluída:`);
  console.log(`   - ${filesModified} arquivos modificados`);
  console.log(`   - ${totalFixed} imports atualizados`);
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch(console.error);

#!/usr/bin/env npx ts-node
/**
 * Codemod para resolver imports legados para novos caminhos
 * Uso: npx ts-node scripts/fix-imports.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Mapa de resolução: caminho antigo -> caminho novo
const IMPORT_MAP: Record<string, string> = {
  // Platform API
  '@/lib/api/handler': '@/platform/api/handler',
  '@/lib/api/errors': '@/platform/api/errors',
  '@/lib/api/types': '@/platform/api/types',
  '@/lib/api/client': '@/platform/api/client',
  '@/lib/api/csrf': '@/platform/api/csrf',
  '@/lib/api/response': '@/platform/api/response',
  '@/lib/api/logger': '@/platform/api/logger',
  '@/lib/api/labels': '@/platform/api/labels',
  '@/lib/api/rate-limit': '@/platform/api/rate-limit',
  '@/lib/api/runtime': '@/platform/api/runtime',
  '@/lib/api/stores': '@/platform/api/stores',

  // Platform DB/Cache
  '@/lib/db': '@/platform/db/db',
  '@/lib/cache': '@/platform/cache/cache',
  '@/lib/redis': '@/platform/cache/redis',
  '@/lib/rate-limit-redis': '@/platform/cache/rate-limit-redis',
  '@/lib/logger': '@/platform/logging/logger',
  '@/lib/audit-admin': '@/platform/logging/audit-admin',

  // Platform Integrations
  '@/lib/mercadopago': '@/platform/integrations/pagarme',
  '@/lib/mercadopago/payments': '@/platform/integrations/pagarme',

  '@/lib/integrations/correios': '@/platform/integrations/correios',
  '@/lib/integrations/correios/client': '@/platform/integrations/correios/client',
  '@/lib/integrations/correios/cep': '@/platform/integrations/correios/cep',
  '@/lib/integrations/correios/precoPrazo': '@/platform/integrations/correios/precoPrazo',
  '@/lib/integrations/correios/prepostagem': '@/platform/integrations/correios/prepostagem',
  '@/lib/integrations/correios/rastro': '@/platform/integrations/correios/rastro',
  '@/lib/integrations/correios/adapter': '@/platform/integrations/correios/adapter',
  '@/lib/integrations/correios/types': '@/platform/integrations/correios/types',
  '@/lib/integrations/correios/constants': '@/platform/integrations/correios/constants',

  '@/lib/correios/agencia-client': '@/platform/integrations/correios/agencia-client',
  '@/lib/correios/label-utils': '@/platform/integrations/correios/label-utils',
  '@/lib/correios/barcode-generator': '@/platform/integrations/correios/barcode-generator',

  '@/lib/integrations/openrouter/client': '@/platform/integrations/openrouter/client',
  '@/lib/integrations/openrouter/config.service': '@/platform/integrations/openrouter/config.service',

  '@/lib/integrations/fipe/client': '@/platform/integrations/fipe/client',
  '@/lib/integrations/fipe': '@/platform/integrations/fipe',

  '@/lib/integrations/payments/payment-credential.service': '@/platform/integrations/payments/payment-credential.service',
  '@/lib/integrations/payments/payment-gateway.service': '@/platform/integrations/payments/payment-gateway.service',
  '@/lib/integrations/payments/payment-transaction.service': '@/platform/integrations/payments/payment-transaction.service',

  '@/lib/integrations/shared/encryption.service': '@/platform/integrations/shared/encryption.service',
  '@/lib/integrations/types': '@/platform/integrations/types',
  '@/lib/integrations/schemas': '@/platform/integrations/schemas',
  '@/lib/integrations/queryKeys': '@/platform/integrations/queryKeys',
  '@/lib/integrations/hooks': '@/platform/integrations/hooks',

  // Platform Email/Storage
  '@/lib/email/mailer': '@/platform/email/mailer',
  '@/lib/email/config': '@/platform/email/config',
  '@/lib/email/recipient-payment': '@/platform/email/recipient-payment',

  '@/lib/storage/support-attachments': '@/platform/storage/support-attachments',
  '@/lib/storage/collector-documents': '@/platform/storage/collector-documents',
  '@/lib/storage/expense-receipts': '@/platform/storage/expense-receipts',

  '@/lib/upload/file-upload': '@/platform/storage/file-upload',
  '@/lib/crypto/card-vault': '@/platform/crypto/card-vault',

  // Platform Services
  '@/lib/services/brasilapi': '@/platform/integrations/shared/brasilapi',
  '@/lib/services/geocoding': '@/platform/integrations/shared/geocoding',
  '@/lib/services/cepLocation': '@/platform/integrations/shared/cepLocation',
  '@/lib/services/distance': '@/platform/integrations/shared/distance',
  '@/lib/services/postgis': '@/platform/db/postgis',
  '@/lib/repositories/system-status.repository': '@/platform/db/system-status.repository',

  // Modules Auth
  '@/lib/auth/session': '@/modules/auth/application/session',
  '@/lib/auth/sessions': '@/modules/auth/application/sessions',
  '@/lib/auth/admin-session': '@/modules/auth/application/admin-session',
  '@/lib/auth/admin-helpers': '@/modules/auth/application/admin-helpers',
  '@/lib/auth/collector-session': '@/modules/auth/application/collector-session',
  '@/lib/auth/autonomous-collector-session': '@/modules/auth/application/autonomous-collector-session',
  '@/lib/auth/user-session': '@/modules/auth/application/user-session',
  '@/lib/auth/jwt': '@/modules/auth/application/jwt',
  '@/lib/auth/jwt-tokens': '@/modules/auth/application/jwt-tokens',
  '@/lib/auth/oauth': '@/modules/auth/application/oauth',
  '@/lib/auth/google-oauth': '@/modules/auth/application/google-oauth',
  '@/lib/auth/rbac': '@/modules/auth/application/rbac',
  '@/lib/auth/permissions': '@/modules/auth/application/permissions',
  '@/lib/auth/roles': '@/modules/auth/application/roles',
  '@/lib/auth/types': '@/modules/auth/application/types',
  '@/lib/auth/hooks': '@/modules/auth/application/hooks',
  '@/lib/auth/route-protection': '@/modules/auth/application/route-protection',

  '@/lib/services/account-cards.service': '@/modules/auth/application/account-cards.service',
  '@/lib/services/account-recipients.service': '@/modules/auth/application/account-recipients.service',
  '@/lib/services/account-security.service': '@/modules/auth/application/account-security.service',

  // Modules Quotes
  '@/lib/quotes/service': '@/modules/quotes/application/service',
  '@/lib/quotes/commission': '@/modules/quotes/application/commission',
  '@/lib/state/quoteDraft': '@/modules/quotes/ui/state/quoteDraft',

  // Modules Cart
  '@/lib/cart/checkout.service': '@/modules/cart/application/checkout.service',
  '@/lib/cart/create-cart-shipments.service': '@/modules/cart/application/create-cart-shipments.service',
  '@/lib/checkout/service': '@/modules/cart/application/service',

  // Modules Shipments
  '@/lib/shipments/shipment-status': '@/modules/shipments/application/shipment-status',
  '@/lib/shipments/create-with-volumes': '@/modules/shipments/application/create-with-volumes',
  '@/lib/shipments/carrier-integration': '@/modules/shipments/application/carrier-integration',
  '@/lib/shipments/correios-shipment': '@/modules/shipments/application/correios-shipment',
  '@/lib/shipments/correios-client': '@/modules/shipments/application/correios-client',
  '@/lib/shipments/status-sync': '@/modules/shipments/application/status-sync',
  '@/lib/shipments/types': '@/modules/shipments/application/types',

  // Modules Wallet
  '@/lib/wallet/wallet.service': '@/modules/wallet/application/wallet.service',
  '@/lib/wallet/period-summary': '@/modules/wallet/application/period-summary',
  '@/lib/wallet/transaction-direction': '@/modules/wallet/application/transaction-direction',

  // Modules Support
  '@/lib/support/service': '@/modules/support/application/service',
  '@/lib/support/collector-service': '@/modules/support/application/collector-service',
  '@/lib/support/autonomous-collector-service': '@/modules/support/application/autonomous-collector-service',
  '@/lib/support/types': '@/modules/support/application/types',
  '@/lib/support/schemas': '@/modules/support/application/schemas',

  // Modules Pickup Points
  '@/lib/pickup/types': '@/modules/pickup-points/application/types',
  '@/lib/pickup/schemas': '@/modules/pickup-points/application/schemas',
  '@/lib/pickup/masks': '@/modules/pickup-points/application/masks',
  '@/lib/services/pickupFee': '@/modules/pickup-points/application/pickupFee',
  '@/lib/services/additionalPickupFee': '@/modules/pickup-points/application/additionalPickupFee',

  // Modules Collectors
  '@/lib/collectors/service': '@/modules/collectors/application/service',
  '@/lib/collectors/types': '@/modules/collectors/application/types',
  '@/lib/collectors/hooks': '@/modules/collectors/application/hooks',
  '@/lib/collectors/schemas': '@/modules/collectors/application/schemas',
  '@/lib/collectors/masks': '@/modules/collectors/application/masks',

  // Modules Coletas
  '@/lib/coletas/types': '@/modules/coletas/application/types',
  '@/lib/coletas/service': '@/modules/coletas/application/service',

  // Modules Labels
  '@/lib/labels/cache': '@/modules/labels/application/cache',
  '@/lib/pdf/document-pdf': '@/modules/labels/infra/document-pdf',

  // Modules Tracking
  '@/lib/tracking/create-event': '@/modules/tracking/application/create-event',
  '@/lib/tracking/service': '@/modules/tracking/application/service',
  '@/lib/tracking-codes/cleanup.service': '@/modules/tracking/application/cleanup.service',

  // Modules Recipients
  '@/lib/recipient-payment/service': '@/modules/recipients/application/service',
  '@/lib/recipient-payment/types': '@/modules/recipients/application/types',
  '@/lib/recipient-payment/validation': '@/modules/recipients/application/validation',

  // Modules Admin
  '@/lib/admin/types': '@/modules/admin/application/types',
  '@/lib/admin/nav': '@/modules/admin/application/nav',
  '@/lib/admin/auth': '@/modules/admin/application/auth',
  '@/lib/admin/ops/api': '@/modules/admin/application/ops/api',
  '@/lib/admin/ops/types': '@/modules/admin/application/ops/types',
  '@/lib/admin/finance/types': '@/modules/admin/application/finance/types',
  '@/lib/admin/finance/api': '@/modules/admin/application/finance/api',
  '@/lib/dashboard/stats': '@/modules/admin/application/stats',

  // Modules Assistant
  '@/lib/assistant/debug': '@/modules/assistant/application/debug',
  '@/lib/assistant/tools': '@/modules/assistant/application/tools',
  '@/lib/assistant/prompts': '@/modules/assistant/application/prompts',

  // Shared Utils
  '@/lib/utils/cn': '@/shared/utils/cn',
  '@/lib/utils/format': '@/shared/utils/format',
  '@/lib/utils/date': '@/shared/utils/date',
  '@/lib/utils/string': '@/shared/utils/string',
  '@/lib/utils/uuid': '@/shared/utils/uuid',
  '@/lib/utils/geo': '@/shared/utils/geo',
  '@/lib/utils/card': '@/shared/utils/card',
  '@/lib/utils/pdf': '@/shared/utils/pdf',
  '@/lib/utils/api-fetch': '@/shared/utils/api-fetch',
  '@/lib/utils/packaging': '@/shared/utils/packaging',
  '@/lib/utils/swapRouteValues': '@/shared/utils/swapRouteValues',
  '@/lib/format': '@/shared/utils/format',
  '@/lib/masks': '@/shared/utils/masks',

  // Shared UI
  '@/lib/ui/theme': '@/shared/ui/theme',
  '@/lib/ui/useAppMessage': '@/shared/ui/useAppMessage',

  // Shared State
  '@/lib/state/addresses': '@/modules/auth/ui/state/addresses',
  '@/lib/state/recipients': '@/modules/recipients/ui/state/recipients',

  // Shared Types
  '@/lib/types/pickup': '@/shared/types/pickup',
  '@/lib/types/invoice': '@/shared/types/invoice',
  '@/lib/types/label': '@/shared/types/label',
  '@/lib/types/shipment': '@/shared/types/shipment-minimal',

  // Config
  '@/lib/config/database': '@/platform/db/database',
  '@/lib/env-validation': '@/platform/db/env-validation',

  // Additional mappings - Pass 2
  '@/lib/auth/tokens': '@/modules/auth/application/tokens',
  '@/lib/auth/schemas': '@/modules/auth/application/schemas',
  '@/lib/admin/finance/dre': '@/modules/admin/application/finance/dre',
  '@/lib/admin/finance/expenses': '@/modules/admin/application/finance/expenses',
  '@/lib/admin/api/clients': '@/modules/admin/application/api/clients',
  '@/lib/checkout/checkout.service': '@/modules/cart/application/checkout.service',
  '@/lib/checkout': '@/modules/cart/application',
  '@/lib/cart': '@/modules/cart/application',
  '@/lib/cart/create-cart-shipments-with-payment.service': '@/modules/cart/application/create-cart-shipments-with-payment.service',
  '@/lib/shipments/status-labels-map': '@/modules/shipments/application/status-labels-map',
  '@/lib/shipments/status-migration': '@/modules/shipments/application/status-migration',
  '@/lib/shipments/public-tracking-status': '@/modules/shipments/application/public-tracking-status',
  '@/lib/shipments/create-paid-shipment.service': '@/modules/shipments/application/create-paid-shipment.service',
  '@/lib/shipments/after-create': '@/modules/shipments/application/after-create',
  '@/lib/services/packaging': '@/shared/utils/packaging',
  '@/lib/services/system-status.service': '@/platform/db/system-status.service',

  // Components mappings
  '@/components/labels': '@/modules/labels/ui/components',
  '@/components/track/TrackingTimeline': '@/modules/tracking/ui/components/TrackingTimeline',
  '@/components/ui/TrackingStatusTag': '@/modules/tracking/ui/components/TrackingStatusTag',
  '@/components/quote/InvoiceItemsTable': '@/modules/quotes/ui/components/InvoiceItemsTable',
  '@/components/wallet/SavedCardPaymentForm': '@/modules/wallet/ui/components/SavedCardPaymentForm',
  '@/components/wallet/CardPaymentForm': '@/modules/wallet/ui/components/CardPaymentForm',

  '@/components/recipients/RecipientModal': '@/modules/recipients/ui/components/RecipientModal',

  // Hooks mappings
  '@/hooks/useRecurringItemsAutocomplete': '@/modules/shipments/ui/hooks/useRecurringItemsAutocomplete',
  '@/hooks/useInvoiceItems': '@/modules/shipments/ui/hooks/useInvoiceItems',
  '@/hooks/useWalletStatus': '@/modules/wallet/ui/hooks/useWalletStatus',

  // More component mappings - Pass 3
  '@/components/wallet/PaymentMethodCard': '@/modules/wallet/ui/components/PaymentMethodCard',
  '@/components/ui/TrackingTimeline': '@/modules/tracking/ui/components/TrackingTimeline',
  '@/components/ui/shipment-status-badge': '@/modules/shipments/ui/components/shipment-status-badge',
  '@/components/ui/QuoteResultCard': '@/modules/quotes/ui/components/QuoteResultCard',
  '@/components/ui/PickupTimeline': '@/modules/pickup-points/ui/components/PickupTimeline',
  '@/components/ui/PickupStatusTag': '@/modules/pickup-points/ui/components/PickupStatusTag',
  '@/components/track/PublicShipmentItems': '@/modules/tracking/ui/components/PublicShipmentItems',
  '@/components/support/SupportFAQ': '@/modules/support/ui/components/SupportFAQ',
  '@/components/support/CannedReplySelect': '@/modules/support/ui/components/CannedReplySelect',
  '@/components/shipping/RouteCards': '@/modules/shipments/ui/components/RouteCards',
  '@/components/shipping/OriginCard': '@/modules/shipments/ui/components/OriginCard',
  '@/components/shipping/DestinationCard': '@/modules/shipments/ui/components/DestinationCard',
  '@/components/shared/LayoutLoader': '@/shared/ui/LayoutLoader',
  '@/components/recipients/RecipientSelect': '@/modules/recipients/ui/components/RecipientSelect',
  '@/components/quote/VolumesGrid': '@/modules/quotes/ui/components/VolumesGrid',
  '@/components/quote/VolumeNFeTab': '@/modules/quotes/ui/components/VolumeNFeTab',
  '@/components/quote/VolumeDeclarationTab': '@/modules/quotes/ui/components/VolumeDeclarationTab',
  '@/components/quote/VolumeDeclarationItems': '@/modules/quotes/ui/components/VolumeDeclarationItems',
  '@/components/quote/ResultsBanner': '@/modules/quotes/ui/components/ResultsBanner',
  '@/components/quote/RecipientModal': '@/modules/quotes/ui/components/RecipientModal',
  '@/components/quote/QuoteForm': '@/modules/quotes/ui/components/QuoteForm',
  '@/components/quote/PostingUnitPicker': '@/modules/quotes/ui/components/PostingUnitPicker',
  '@/components/quote/PackageNFeRow': '@/modules/quotes/ui/components/PackageNFeRow',
  '@/components/quote/LabelPreview': '@/modules/quotes/ui/components/LabelPreview',
  '@/components/quote/DocumentChooser': '@/modules/quotes/ui/components/DocumentChooser',
  '@/components/pickups/PickupWizard': '@/modules/pickup-points/ui/components/PickupWizard',
  '@/components/pickups/PickupSummary': '@/modules/pickup-points/ui/components/PickupSummary',
  '@/components/pickups/PickupShipmentsTable': '@/modules/pickup-points/ui/components/PickupShipmentsTable',
  '@/components/payments/RecipientPaymentModal': '@/modules/payments/ui/components/RecipientPaymentModal',
  '@/components/payments/RecipientCardPaymentForm': '@/modules/payments/ui/components/RecipientCardPaymentForm',
  '@/components/payments/PaymentModal': '@/modules/payments/ui/components/PaymentModal',
  '@/components/payments/PaidCheckoutModal': '@/modules/payments/ui/components/PaidCheckoutModal',
  '@/components/payments/CheckoutModal': '@/modules/payments/ui/components/CheckoutModal',
  '@/components/labels/LabelsTable': '@/modules/labels/ui/components/LabelsTable',
  '@/components/labels/LabelPrintModal': '@/modules/labels/ui/components/LabelPrintModal',
  '@/components/cotacoes/MinhasEmbalagensSelect': '@/modules/quotes/ui/components/MinhasEmbalagensSelect',
  '@/components/assistant': '@/modules/assistant/ui/components',
  '@/components/addresses/AddressSelect': '@/modules/auth/ui/components/AddressSelect',
  '@/components/account/PersonalForm': '@/modules/auth/ui/components/PersonalForm',
  '@/components/account/CardModal': '@/modules/auth/ui/components/CardModal',
  '@/components/account/AddressModal': '@/modules/auth/ui/components/AddressModal',
  '@/components/account/AccountTabs': '@/modules/auth/ui/components/AccountTabs',

  // Assistant tools
  '@/lib/assistant/tools/orchestrator': '@/modules/assistant/application/tools/orchestrator',
  '@/lib/assistant/tools/definitions': '@/modules/assistant/application/tools/definitions',
  '@/lib/assistant/prompts/system': '@/modules/assistant/application/prompts/system',

  // Adapters
  '@/lib/adapters/label-from-shipment': '@/shared/utils/label-from-shipment',

  // Admin components
  '@/modules/admin/ui/components/users/RoleEditor': '@/components/admin/users/RoleEditor',
};

// Função para encontrar todos os arquivos TS/TSX
function findFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Ignorar node_modules, .next, .git
        if (!['node_modules', '.next', '.git', 'coverage', 'logs'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

// Função para processar um arquivo
function processFile(filePath: string): { modified: boolean; changes: string[] } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const changes: string[] = [];

  // Processar cada mapeamento
  for (const [oldPath, newPath] of Object.entries(IMPORT_MAP)) {
    // Regex para capturar imports com aspas simples ou duplas
    const regex = new RegExp(
      `(from\\s+['"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"])`,
      'g'
    );

    if (regex.test(content)) {
      content = content.replace(regex, `$1${newPath}$2`);
      changes.push(`${oldPath} -> ${newPath}`);
    }

    // Também verificar imports dinâmicos
    const dynamicRegex = new RegExp(
      `(import\\s*\\(['"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"]\\))`,
      'g'
    );

    if (dynamicRegex.test(content)) {
      content = content.replace(dynamicRegex, `$1${newPath}$2`);
      changes.push(`dynamic: ${oldPath} -> ${newPath}`);
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { modified: true, changes };
  }

  return { modified: false, changes: [] };
}

// Main
function main() {
  const rootDir = process.cwd();
  const targetDirs = ['app', 'components', 'hooks', 'stores', 'store', 'lib', 'modules', 'shared', 'platform', 'types'];

  let totalFiles = 0;
  let modifiedFiles = 0;
  let totalChanges = 0;

  console.log('🔄 Iniciando codemod de imports...\n');

  for (const dir of targetDirs) {
    const dirPath = path.join(rootDir, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = findFiles(dirPath, ['.ts', '.tsx']);

    for (const file of files) {
      totalFiles++;
      const result = processFile(file);

      if (result.modified) {
        modifiedFiles++;
        totalChanges += result.changes.length;
        const relativePath = path.relative(rootDir, file);
        console.log(`✅ ${relativePath}`);
        for (const change of result.changes) {
          console.log(`   ${change}`);
        }
      }
    }
  }

  console.log('\n📊 Resumo:');
  console.log(`   Arquivos processados: ${totalFiles}`);
  console.log(`   Arquivos modificados: ${modifiedFiles}`);
  console.log(`   Total de substituições: ${totalChanges}`);
}

main();

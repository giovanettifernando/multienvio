#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const filesToFix = [
  'app/api/admin/clients/block/route.ts',
  'app/api/admin/clients/unblock/route.ts',
  'app/api/admin/staff/users/[id]/reset/route.ts',
  'app/api/admin/staff/users/[id]/route.ts',
  'app/api/admin/staff/users/route.ts',
  'app/api/admin/clients/[id]/wallet/adjust/route.ts',
  'app/api/admin/config/faq/[id]/route.ts',
  'app/api/admin/config/faq/route.ts',
  'app/api/admin/config/google-oauth/route.ts',
  'app/api/admin/config/google-oauth/test/route.ts',
  'app/api/admin/config/openrouter/models/route.ts',
  'app/api/admin/config/openrouter/playground/route.ts',
  'app/api/admin/config/openrouter/route.ts',
  'app/api/admin/config/openrouter/test/route.ts',
  'app/api/admin/integrations/correios/rotulo/route.ts',
  'app/api/admin/integrations/correios/route.ts',
  'app/api/admin/integrations/correios/sync-tracking/route.ts',
  'app/api/admin/integrations/correios/test/route.ts',
  'app/api/admin/integrations/mercadopago/route.ts',
  'app/api/admin/integrations/mercadopago/test-webhook/route.ts',
  'app/api/admin/knowledge-base/[id]/route.ts',
  'app/api/admin/knowledge-base/route.ts',
  'app/api/admin/payment-gateway/config/route.ts',
  'app/api/admin/payment-transactions/[id]/force-approve/route.ts',
  'app/api/admin/payment-transactions/pending/route.ts',
  'app/api/admin/payment-transactions/sync/route.ts',
  'app/api/admin/pickup-points/[id]/route.ts',
];

for (const file of filesToFix) {
  const filePath = join(projectRoot, file);
  let content;

  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.log(`⏭️  File not found: ${file}`);
    continue;
  }

  let updated = false;

  // Add ApiError import if missing
  if (content.includes('ApiError') && !content.includes("import { ApiError }")) {
    const handlerImport = content.indexOf("from '@/platform/api/handler'");
    if (handlerImport !== -1) {
      const handlerLine = content.lastIndexOf('\n', handlerImport);
      const handlerImportMatch = content.slice(handlerLine + 1, handlerImport + 50).match(/import\s*\{([^}]+)\}/);
      if (handlerImportMatch) {
        const imports = handlerImportMatch[1].split(',').map(s => s.trim());
        if (!imports.includes('ApiError')) {
          imports.push('ApiError');
          const newImport = `import { ${imports.join(', ')} }`;
          content = content.slice(0, handlerLine + 1) +
            content.slice(handlerLine + 1).replace(/import\s*\{[^}]+\}\s*from '@\/platform\/api\/handler'/, newImport + " from '@/platform/api/handler'");
          updated = true;
        }
      }
    }
  }

  // Replace requireAdminUser calls that weren't caught
  if (content.includes('requireAdminUser')) {
    // Pattern: const authResult = await requireAdminUser(req);
    content = content.replace(
      /const\s+authResult\s*=\s*await\s+requireAdminUser\(req(?:,\s*AdminPermission\.\w+)?\);/g,
      (match) => {
        const permMatch = match.match(/AdminPermission\.(\w+)/);
        const perm = permMatch ? `, AdminPermission.${permMatch[1]}` : '';
        return `const session = await requireAdminSession(req${perm});`;
      }
    );

    // Remove NextResponse check
    content = content.replace(
      /if\s*\(authResult\s+instanceof\s+NextResponse\)\s*\{[^}]+throw new ApiError\([^)]+\);\s*\}/g,
      ''
    );

    // Replace authResult references
    content = content.replace(/authResult\.user\.id/g, 'session.staffId');
    content = content.replace(/authResult\.user\.email/g, 'session.email');

    updated = true;
  }

  // Clean up multiple blank lines
  content = content.replace(/\n\n\n+/g, '\n\n');

  if (updated) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${file}`);
  } else {
    console.log(`⏭️  No changes needed: ${file}`);
  }
}

console.log('\n✅ Done!');

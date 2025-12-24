#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const filesToClean = [
  'app/api/admin/correios-agencies/route.ts',
  'app/api/admin/correios-agencies/sync/route.ts',
  'app/api/admin/email-config/test-connection/route.ts',
  'app/api/admin/email-config/route.ts',
  'app/api/admin/email-config/send-test/route.ts',
  'app/api/admin/ceps/manual-update/route.ts',
  'app/api/admin/ceps/list-low-precision/route.ts',
  'app/api/admin/ceps/force-regeocode/route.ts',
  'app/api/admin/ceps/list-manual-overrides/route.ts',
  'app/api/admin/fipe/brands/route.ts',
  'app/api/admin/fipe/models/route.ts',
  'app/api/admin/fipe/sync/route.ts',
  'app/api/admin/payment-transactions/[id]/force-approve/route.ts',
  'app/api/admin/auth/logout/route.ts',
];

let cleanedCount = 0;

for (const file of filesToClean) {
  const filePath = join(projectRoot, file);
  let content;

  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.log(`⏭️  File not found: ${file}`);
    continue;
  }

  // Check if file uses the old import
  if (!content.includes('getAdminSessionFromRequest') && !content.includes('getAdminFromRequest')) {
    continue;
  }

  // Remove the old import line
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    return !line.includes("from '@/modules/auth/application/admin-session'") ||
           line.includes('createAdminCookieRemovalHeader'); // Keep if it imports other things like logout
  });

  const newContent = filteredLines.join('\n');

  if (newContent !== content) {
    writeFileSync(filePath, newContent, 'utf-8');
    cleanedCount++;
    console.log(`✅ Cleaned: ${file}`);
  } else {
    console.log(`⏭️  No changes needed: ${file}`);
  }
}

console.log(`\n✅ Cleaned ${cleanedCount} files`);

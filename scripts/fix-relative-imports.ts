#!/usr/bin/env npx ts-node
/**
 * Codemod para converter imports relativos legados em imports absolutos
 * para arquivos dentro de modules/, shared/, platform/
 */

import * as fs from 'fs';
import * as path from 'path';

// Mapa de imports relativos para absolutos
// Quando um arquivo em modules/X importa ../Y, convertemos para @/platform/Y ou @/shared/Y
const RELATIVE_TO_ABSOLUTE: Record<string, string> = {
  // API
  '../api/errors': '@/platform/api/errors',
  '../api/types': '@/platform/api/types',
  '../api/handler': '@/platform/api/handler',
  '../api/response': '@/platform/api/response',
  '../api/client': '@/platform/api/client',
  '../api/csrf': '@/platform/api/csrf',
  '../api/logger': '@/platform/api/logger',
  '../api/rate-limit': '@/platform/api/rate-limit',

  // DB
  '../db': '@/platform/db/db',
  '../db/db': '@/platform/db/db',
  './db': '@/platform/db/db',

  // Cache
  '../cache': '@/platform/cache/cache',
  '../cache/cache': '@/platform/cache/cache',
  '../redis': '@/platform/cache/redis',
  '../rate-limit-redis': '@/platform/cache/rate-limit-redis',

  // Logging
  '../logger': '@/platform/logging/logger',
  './logger': '@/platform/logging/logger',
  '../logging/logger': '@/platform/logging/logger',
  '../audit-admin': '@/platform/logging/audit-admin',

  // Crypto
  '../crypto/card-vault': '@/platform/crypto/card-vault',

  // Utils
  '../utils/cn': '@/shared/utils/cn',
  '../utils/format': '@/shared/utils/format',
  '../utils/date': '@/shared/utils/date',
  '../utils/string': '@/shared/utils/string',
  '../utils/uuid': '@/shared/utils/uuid',
  '../utils/geo': '@/shared/utils/geo',
  '../utils/card': '@/shared/utils/card',
  '../utils/pdf': '@/shared/utils/pdf',
  '../utils/api-fetch': '@/shared/utils/api-fetch',
  '../utils/packaging': '@/shared/utils/packaging',
  '../format': '@/shared/utils/format',
  '../masks': '@/shared/utils/masks',

  // Validation
  '../validation/card': '@/modules/payments/dto/card',
  '../validation/recipient': '@/modules/recipients/dto/recipient',
  '../validation/password-policy': '@/modules/auth/dto/password-policy',
  '../validation/auth': '@/modules/auth/dto/auth',
  '../validation/profile': '@/modules/auth/dto/profile',
  '../validation/account': '@/modules/auth/dto/account',

  // UI
  '../ui/theme': '@/shared/ui/theme',
  '../ui/useAppMessage': '@/shared/ui/useAppMessage',

  // Types
  '../types/pickup': '@/shared/types/pickup',
  '../types/invoice': '@/shared/types/invoice',
  '../types/label': '@/shared/types/label',
  '../types/shipment': '@/shared/types/shipment',

  // Email
  '../email/mailer': '@/platform/email/mailer',
  '../email/config': '@/platform/email/config',
  '../email/recipient-payment': '@/platform/email/recipient-payment',

  // Storage
  '../storage/support-attachments': '@/platform/storage/support-attachments',
  '../storage/collector-documents': '@/platform/storage/collector-documents',
  '../storage/file-upload': '@/platform/storage/file-upload',
  '../upload/file-upload': '@/platform/storage/file-upload',

  // Integrations
  '../integrations/shared/encryption.service': '@/platform/integrations/shared/encryption.service',
  '../integrations/correios': '@/platform/integrations/correios',
  '../integrations/correios/client': '@/platform/integrations/correios/client',

  // Services that became platform
  '../services/brasilapi': '@/platform/integrations/shared/brasilapi',
  '../services/geocoding': '@/platform/integrations/shared/geocoding',
  '../services/cepLocation': '@/platform/integrations/shared/cepLocation',
  '../services/distance': '@/platform/integrations/shared/distance',
  '../services/postgis': '@/platform/db/postgis',

  // Repositories
  '../repositories/system-status.repository': '@/platform/db/system-status.repository',

  // Config
  '../config/database': '@/platform/db/database',
  './config/database': '@/platform/db/database',
};

// Dentro de platform/, imports relativos que precisam ser convertidos
const PLATFORM_RELATIVE_TO_ABSOLUTE: Record<string, string> = {
  './db': '@/platform/db/db',
  '../db': '@/platform/db/db',
  '../db/db': '@/platform/db/db',
  './cache': '@/platform/cache/cache',
  '../cache': '@/platform/cache/cache',
  '../cache/cache': '@/platform/cache/cache',
  './logger': '@/platform/logging/logger',
  '../logger': '@/platform/logging/logger',
  '../logging/logger': '@/platform/logging/logger',
  './redis': '@/platform/cache/redis',
  '../redis': '@/platform/cache/redis',
  '../integrations/shared/encryption.service': '@/platform/integrations/shared/encryption.service',
  './encryption.service': '@/platform/integrations/shared/encryption.service',
  '../shared/encryption.service': '@/platform/integrations/shared/encryption.service',
};

function findFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    if (!fs.existsSync(currentPath)) return;
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!['node_modules', '.next', '.git'].includes(entry.name)) {
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

function processFile(filePath: string): { modified: boolean; changes: string[] } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const changes: string[] = [];

  // Determinar qual mapa usar baseado no diretório
  const isPlatform = filePath.includes('/platform/');
  const isModulesOrShared = filePath.includes('/modules/') || filePath.includes('/shared/');

  const mapToUse = isPlatform
    ? { ...RELATIVE_TO_ABSOLUTE, ...PLATFORM_RELATIVE_TO_ABSOLUTE }
    : RELATIVE_TO_ABSOLUTE;

  // Processar imports relativos
  for (const [oldPath, newPath] of Object.entries(mapToUse)) {
    // Escapar caracteres especiais no regex
    const escapedOld = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Regex para from "path" ou from 'path'
    const regex = new RegExp(
      `(from\\s+['"])${escapedOld}(['"])`,
      'g'
    );

    if (regex.test(content)) {
      content = content.replace(regex, `$1${newPath}$2`);
      changes.push(`${oldPath} -> ${newPath}`);
    }

    // Também verificar imports dinâmicos
    const dynamicRegex = new RegExp(
      `(import\\s*\\(['"])${escapedOld}(['"]\\))`,
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

function main() {
  const rootDir = process.cwd();
  const targetDirs = ['modules', 'shared', 'platform'];

  let totalFiles = 0;
  let modifiedFiles = 0;
  let totalChanges = 0;

  console.log('🔄 Corrigindo imports relativos em modules/shared/platform...\n');

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

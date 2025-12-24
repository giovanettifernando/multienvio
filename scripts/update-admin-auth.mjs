#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Mapping of route paths to appropriate permissions
const routePermissions = {
  '/api/admin/clients/': 'AdminPermission.CONTAS',
  '/api/admin/finance/': 'AdminPermission.FINANCEIRO',
  '/api/admin/ops/': 'AdminPermission.OPERACOES',
  '/api/admin/integrations/': 'AdminPermission.INTEGRACOES',
  '/api/admin/support/': 'AdminPermission.SUPORTE',
  '/api/admin/coletores/': 'AdminPermission.COLETORES',
  '/api/admin/pickup-points/': 'AdminPermission.PONTOS_COLETA',
  '/api/admin/staff/': 'AdminPermission.USUARIOS',
  '/api/admin/config/': 'AdminPermission.CONFIGURACOES',
  '/api/admin/correios-agencies/': 'AdminPermission.OPERACOES',
  '/api/admin/ceps/': 'AdminPermission.OPERACOES',
  '/api/admin/fipe/': 'AdminPermission.CONFIGURACOES',
  '/api/admin/knowledge-base/': 'AdminPermission.SUPORTE',
  '/api/admin/email-config/': 'AdminPermission.CONFIGURACOES',
  '/api/admin/payment-gateway/': 'AdminPermission.FINANCEIRO',
  '/api/admin/payment-transactions/': 'AdminPermission.FINANCEIRO',
};

// Files to skip (already updated or special cases)
const skipFiles = [
  '/api/admin/auth/login/route.ts',
  '/api/admin/auth/heartbeat/route.ts',
  '/api/admin/auth/refresh/route.ts',
];

function getPermissionForRoute(filePath) {
  const relativePath = filePath.replace(projectRoot, '');

  for (const [routePrefix, permission] of Object.entries(routePermissions)) {
    if (relativePath.includes(routePrefix)) {
      return permission;
    }
  }

  // Default: no specific permission (general admin access)
  return null;
}

function shouldSkipFile(filePath) {
  const relativePath = filePath.replace(projectRoot, '');
  return skipFiles.some(skip => relativePath.includes(skip));
}

function updateFile(filePath) {
  if (shouldSkipFile(filePath)) {
    console.log(`⏭️  Skipping: ${filePath}`);
    return { updated: false, skipped: true };
  }

  let content = readFileSync(filePath, 'utf-8');

  // Check if already using requireAdminSession
  if (content.includes('requireAdminSession')) {
    console.log(`✅ Already updated: ${filePath}`);
    return { updated: false, alreadyUpdated: true };
  }

  // Check if uses old auth pattern
  if (!content.includes('getAdminSessionFromRequest') &&
      !content.includes('getAdminFromRequest') &&
      !content.includes('requireAdminUser')) {
    console.log(`⏭️  No auth to update: ${filePath}`);
    return { updated: false, noAuth: true };
  }

  let updated = false;

  // Update imports - getAdminSessionFromRequest
  if (content.includes("from '@/modules/auth/application/admin-session'")) {
    content = content.replace(
      /import\s*\{[^}]*getAdminSessionFromRequest[^}]*\}\s*from\s*'@\/modules\/auth\/application\/admin-session';?/g,
      (match) => {
        // Check if ApiError is in the same import
        if (match.includes('ApiError')) {
          return '';
        }
        return match;
      }
    );

    // Add new import if not present
    if (!content.includes("from '@/platform/auth/require-session'")) {
      const firstImport = content.indexOf('import');
      const endOfFirstImport = content.indexOf('\n', firstImport);
      content = content.slice(0, endOfFirstImport + 1) +
        "import { requireAdminSession } from '@/platform/auth/require-session';\n" +
        content.slice(endOfFirstImport + 1);
    }

    // Add AdminPermission import if not present
    if (!content.includes('AdminPermission') || !content.includes("from '@prisma/client'")) {
      const requireSessionImport = content.indexOf("from '@/platform/auth/require-session'");
      const endOfRequireSessionImport = content.indexOf('\n', requireSessionImport);
      content = content.slice(0, endOfRequireSessionImport + 1) +
        "import { AdminPermission } from '@prisma/client';\n" +
        content.slice(endOfRequireSessionImport + 1);
    }

    updated = true;
  }

  // Update imports - requireAdminUser
  if (content.includes("requireAdminUser") && content.includes("from '@/modules/auth/application/admin-helpers'")) {
    content = content.replace(
      /import\s*\{[^}]*requireAdminUser[^}]*\}\s*from\s*'@\/modules\/auth\/application\/admin-helpers';?/g,
      ''
    );

    // Remove NextResponse import if it was only used for auth
    if (content.includes("import { NextResponse } from 'next/server'") &&
        !content.includes('NextResponse.json') &&
        !content.includes('return NextResponse')) {
      content = content.replace(/import\s*\{[^}]*NextResponse[^}]*\}\s*from\s*'next\/server';?/g, '');
    }

    // Add new import
    if (!content.includes("from '@/platform/auth/require-session'")) {
      const firstImport = content.indexOf('import');
      const endOfFirstImport = content.indexOf('\n', firstImport);
      content = content.slice(0, endOfFirstImport + 1) +
        "import { requireAdminSession } from '@/platform/auth/require-session';\n" +
        content.slice(endOfFirstImport + 1);
    }

    updated = true;
  }

  // Get permission for this route
  const permission = getPermissionForRoute(filePath);
  const permissionParam = permission ? `, ${permission}` : '';

  // Replace auth patterns
  // Pattern 1: getAdminSessionFromRequest with manual checks
  content = content.replace(
    /const\s+session\s*=\s*await\s+getAdminSessionFromRequest\(req\);\s*if\s*\(!session\)\s*\{[^}]+throw new ApiError\([^)]+\);\s*\}/g,
    `const session = await requireAdminSession(req${permissionParam});`
  );

  // Pattern 2: getAdminSessionFromRequest with permission check
  content = content.replace(
    /const\s+session\s*=\s*await\s+getAdminSessionFromRequest\(req\);\s*if\s*\(!session\)\s*\{[^}]+throw new ApiError\([^)]+\);\s*\}\s*if\s*\(!session\.permissions\.includes\(AdminPermission\.\w+\)(?:\s*&&\s*!session\.isSuperAdmin)?\)\s*\{[^}]+throw new ApiError\([^)]+\);\s*\}/g,
    `const session = await requireAdminSession(req${permissionParam});`
  );

  // Pattern 3: requireAdminUser pattern
  content = content.replace(
    /const\s+authResult\s*=\s*await\s+requireAdminUser\(req(?:,\s*AdminPermission\.\w+)?\);\s*if\s*\(authResult\s+instanceof\s+NextResponse\)\s*\{[^}]+throw new ApiError\([^)]+\);\s*\}/g,
    `const session = await requireAdminSession(req${permissionParam});`
  );

  // Replace authResult.user.id with session.staffId
  content = content.replace(/authResult\.user\.id/g, 'session.staffId');
  content = content.replace(/authResult\.user\.email/g, 'session.email');

  // Clean up empty lines
  content = content.replace(/\n\n\n+/g, '\n\n');

  if (updated) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Updated: ${filePath}`);
    return { updated: true };
  }

  return { updated: false };
}

function findRouteFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry === 'route.ts') {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// Main
const adminApiDir = join(projectRoot, 'app', 'api', 'admin');
const routeFiles = findRouteFiles(adminApiDir);

console.log(`Found ${routeFiles.length} route files in ${adminApiDir}\n`);

let updated = 0;
let skipped = 0;
let alreadyUpdated = 0;
let noAuth = 0;

for (const file of routeFiles) {
  const result = updateFile(file);
  if (result.updated) updated++;
  if (result.skipped) skipped++;
  if (result.alreadyUpdated) alreadyUpdated++;
  if (result.noAuth) noAuth++;
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Updated: ${updated}`);
console.log(`   ✓  Already updated: ${alreadyUpdated}`);
console.log(`   ⏭️  Skipped: ${skipped}`);
console.log(`   -  No auth: ${noAuth}`);
console.log(`   📁 Total: ${routeFiles.length}`);

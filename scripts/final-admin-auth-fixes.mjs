#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

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

const adminApiDir = join(projectRoot, 'app', 'api', 'admin');
const routeFiles = findRouteFiles(adminApiDir);

let fixedCount = 0;

for (const filePath of routeFiles) {
  let content = readFileSync(filePath, 'utf-8');
  let updated = false;

  // Fix 1: Replace incorrect ApiError import from handler
  if (content.match(/import\s*\{\s*withApiHandler,\s*ApiError\s*\}\s*from\s*'@\/platform\/api\/handler'/)) {
    content = content.replace(
      /import\s*\{\s*withApiHandler,\s*ApiError\s*\}\s*from\s*'@\/platform\/api\/handler'/g,
      "import { withApiHandler } from '@/platform/api/handler';\nimport { ApiError } from '@/platform/api/errors'"
    );
    updated = true;
  }

  // Fix 2: Remove leftover authResult instanceof checks
  if (content.includes('authResult instanceof Response') || content.includes('authResult instanceof NextResponse')) {
    content = content.replace(
      /if\s*\(authResult\s+instanceof\s+(Response|NextResponse)\)\s*\{[^}]*throw new ApiError\([^)]*\);\s*\}/g,
      ''
    );
    updated = true;
  }

  // Clean up multiple blank lines
  content = content.replace(/\n\n\n+/g, '\n\n');

  if (updated) {
    writeFileSync(filePath, content, 'utf-8');
    fixedCount++;
    console.log(`✅ Fixed: ${filePath.replace(projectRoot, '')}`);
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

async function main() {
  // Find all test files in tests/unit and tests/integration
  const testFiles = await glob('tests/{unit,integration}/**/*.test.ts');

  console.log(`Found ${testFiles.length} test files to process`);

  let fixedCount = 0;

  for (const file of testFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;

    // Replace relative imports with @/ aliases
    // Match patterns like: from '../../../lib/something'
    const relativeImportRegex = /from ['"](\.\.[\/\\])+([^'"]+)['"]/g;

    const newContent = content.replace(relativeImportRegex, (match, dots, importPath) => {
      // Count the number of ../ to determine depth
      const dotsMatch = match.match(/\.\.\//g) || [];
      const depth = dotsMatch.length;

      // Clean up the import path (remove .ts extension if present)
      let cleanPath = importPath.replace(/\.ts$/, '');

      // Map to @/ alias
      // From tests/unit/xxx, depth 3 means going to root
      // From tests/unit/subdir/xxx, depth 4 means going to root
      if (cleanPath.startsWith('lib/')) {
        modified = true;
        return `from '@/${cleanPath}'`;
      }
      if (cleanPath.startsWith('shared/')) {
        modified = true;
        return `from '@/${cleanPath}'`;
      }
      if (cleanPath.startsWith('modules/')) {
        modified = true;
        return `from '@/${cleanPath}'`;
      }
      if (cleanPath.startsWith('platform/')) {
        modified = true;
        return `from '@/${cleanPath}'`;
      }
      if (cleanPath.startsWith('app/')) {
        modified = true;
        return `from '@/${cleanPath}'`;
      }
      if (cleanPath.startsWith('types/')) {
        modified = true;
        return `from '@/${cleanPath}'`;
      }
      if (cleanPath.startsWith('hooks/')) {
        modified = true;
        return `from '@/${cleanPath}'`;
      }

      // Keep original if no match
      return match;
    });

    if (modified) {
      fs.writeFileSync(file, newContent);
      fixedCount++;
      console.log(`  Fixed: ${file}`);
    }
  }

  console.log(`\nFixed ${fixedCount} files`);
}

main().catch(console.error);

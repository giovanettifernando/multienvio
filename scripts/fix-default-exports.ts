import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

async function main() {
  // Find all modules with default exports
  const moduleFiles = await glob('modules/*/ui/components/*.tsx');
  const componentsWithDefault: string[] = [];

  for (const file of moduleFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('export default')) {
      componentsWithDefault.push(file);
    }
  }

  console.log(`Found ${componentsWithDefault.length} modules with default exports`);

  // Check re-exports in components/
  const reexportFiles = await glob('components/**/*.{ts,tsx}');
  const needsFix: { file: string; source: string }[] = [];

  for (const file of reexportFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("export * from '@/modules")) {
      if (!content.includes('export { default }')) {
        // Extract source path
        const match = content.match(/export \* from '(@\/modules[^']+)'/);
        if (match) {
          const sourcePath = match[1].replace('@/', '') + '.tsx';
          if (fs.existsSync(sourcePath)) {
            const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
            if (sourceContent.includes('export default')) {
              needsFix.push({ file, source: match[1] });
            }
          }
        }
      }
    }
  }

  console.log(`\nFiles needing default export fix (${needsFix.length}):`);
  for (const { file, source } of needsFix) {
    console.log(`  ${file} -> ${source}`);

    // Fix the file
    const content = fs.readFileSync(file, 'utf-8');
    const newContent = content.trimEnd() + `\nexport { default } from '${source}';\n`;
    fs.writeFileSync(file, newContent);
    console.log(`    -> Fixed`);
  }
}

main().catch(console.error);

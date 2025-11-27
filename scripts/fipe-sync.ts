/**
 * Script CLI para sincronização da base FIPE
 *
 * Uso:
 *   npm run fipe:sync
 *   # ou
 *   npx tsx scripts/fipe-sync.ts
 *
 * Este script deve ser executado mensalmente via cron ou manualmente.
 * Ele sincroniza marcas e modelos de veículos da tabela FIPE com o banco local.
 *
 * Variáveis de ambiente opcionais:
 *   FIPE_BASE_URL - URL base da API FIPE (default: https://fipe.parallelum.com.br/api/v2)
 *   FIPE_SUBSCRIPTION_TOKEN - Token para aumentar limite de requisições (opcional)
 */

import { syncFipeBrandsAndModels, getFipeStats, type SyncOptions } from '@/lib/integrations/fipe';

// Parse argumentos de linha de comando
function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {
    vehicleTypes: ['cars'], // Default: apenas carros
    deactivateOld: true,
  };

  for (const arg of args) {
    if (arg === '--motorcycles' || arg === '-m') {
      options.vehicleTypes = [...(options.vehicleTypes || []), 'motorcycles'];
    }
    if (arg === '--trucks' || arg === '-t') {
      options.vehicleTypes = [...(options.vehicleTypes || []), 'trucks'];
    }
    if (arg === '--all' || arg === '-a') {
      options.vehicleTypes = ['cars', 'motorcycles', 'trucks'];
    }
    if (arg === '--no-deactivate') {
      options.deactivateOld = false;
    }
    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  // Remove duplicatas
  options.vehicleTypes = [...new Set(options.vehicleTypes)];

  return options;
}

function showHelp(): void {
  console.log(`
FIPE Sync - Sincronização de marcas e modelos de veículos

Uso:
  npm run fipe:sync [opções]
  npx tsx scripts/fipe-sync.ts [opções]

Opções:
  -h, --help          Mostra esta ajuda
  -m, --motorcycles   Inclui motos na sincronização
  -t, --trucks        Inclui caminhões na sincronização
  -a, --all           Sincroniza todos os tipos (carros, motos, caminhões)
  --no-deactivate     Não desativa registros de referências antigas

Variáveis de ambiente:
  FIPE_BASE_URL             URL base da API FIPE
  FIPE_SUBSCRIPTION_TOKEN   Token para aumentar limite de requisições

Exemplos:
  npm run fipe:sync              # Sincroniza apenas carros
  npm run fipe:sync --all        # Sincroniza todos os tipos
  npm run fipe:sync -m -t        # Sincroniza carros, motos e caminhões
`);
}

async function main(): Promise<void> {
  console.log('========================================');
  console.log('FIPE SYNC - Sincronização de Veículos');
  console.log('========================================\n');

  const options = parseArgs();

  console.log(`Tipos de veículos: ${options.vehicleTypes?.join(', ')}`);
  console.log(`Desativar registros antigos: ${options.deactivateOld ? 'Sim' : 'Não'}`);
  console.log('');

  // Mostrar estatísticas antes do sync
  console.log('--- Estatísticas antes do sync ---');
  const statsBefore = await getFipeStats();
  console.log(`  Marcas ativas: ${statsBefore.brandsCount}`);
  console.log(`  Modelos ativos: ${statsBefore.modelsCount}`);
  if (statsBefore.latestReferenceMonth) {
    console.log(`  Última referência: ${statsBefore.latestReferenceMonth} (${statsBefore.latestReferenceCode})`);
  } else {
    console.log('  Base vazia - primeira sincronização');
  }
  console.log('');

  // Executar sync
  console.log('--- Iniciando sincronização ---\n');
  const result = await syncFipeBrandsAndModels(options);

  // Mostrar resultado
  console.log('\n--- Resultado ---');
  console.log(`  Referência: ${result.referenceMonth} (${result.referenceCode})`);
  console.log(`  Tipos processados: ${result.vehicleTypes.join(', ')}`);
  console.log(`  Marcas: ${result.brands.created} criadas, ${result.brands.updated} atualizadas (total: ${result.brands.total})`);
  console.log(`  Modelos: ${result.models.created} criados, ${result.models.updated} atualizados (total: ${result.models.total})`);
  console.log(`  Duração: ${(result.durationMs / 1000).toFixed(1)}s`);

  if (result.errors.length > 0) {
    console.log(`\n--- Erros (${result.errors.length}) ---`);
    result.errors.slice(0, 10).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
    if (result.errors.length > 10) {
      console.log(`  ... e mais ${result.errors.length - 10} erros`);
    }
  }

  // Mostrar estatísticas depois do sync
  console.log('\n--- Estatísticas após o sync ---');
  const statsAfter = await getFipeStats();
  console.log(`  Marcas ativas: ${statsAfter.brandsCount}`);
  console.log(`  Modelos ativos: ${statsAfter.modelsCount}`);
  console.log('');

  // Exit code baseado em erros
  if (result.errors.length > 0) {
    console.log('⚠️  Sync concluído com erros');
    process.exit(1);
  } else {
    console.log('✅ Sync concluído com sucesso');
    process.exit(0);
  }
}

// Executar
main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});

/**
 * Script para remover eventos genéricos "Atualização de status"
 *
 * Esses eventos foram criados pela plataforma como marcadores iniciais,
 * mas agora são redundantes com o sync dos Correios.
 *
 * Uso:
 *   npx tsx scripts/cleanup-generic-events.ts --dry-run
 *   npx tsx scripts/cleanup-generic-events.ts --apply
 */

import { prisma } from './lib/db';

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2);
  const hasApply = args.includes('--apply');
  return { dryRun: !hasApply };
}

async function main() {
  const { dryRun } = parseArgs();

  console.log('\n======================================================================');
  console.log('  LIMPEZA DE EVENTOS GENÉRICOS');
  console.log('  Modo:', dryRun ? 'DRY-RUN (simulação)' : 'APPLY (removendo)');
  console.log('======================================================================\n');

  // Buscar eventos genéricos
  const events = await prisma.trackingEvent.findMany({
    where: { description: 'Atualização de status' },
    include: {
      shipment: {
        select: { platformTrackingCode: true }
      }
    },
    orderBy: { occurredAt: 'desc' }
  });

  console.log('Eventos encontrados:', events.length);

  if (events.length === 0) {
    console.log('\nNenhum evento para remover.');
    return;
  }

  console.log('\nEventos a serem removidos:');
  console.log('─'.repeat(80));

  for (const e of events.slice(0, 10)) {
    console.log('  ' + e.shipment.platformTrackingCode + ' | ' + e.type + ' | ' + e.occurredAt.toISOString());
  }

  if (events.length > 10) {
    console.log('  ... e mais ' + (events.length - 10) + ' eventos');
  }

  console.log('─'.repeat(80));

  if (!dryRun) {
    const result = await prisma.trackingEvent.deleteMany({
      where: { description: 'Atualização de status' }
    });

    console.log('\n✅ Removidos:', result.count, 'eventos');
  } else {
    console.log('\n⏸️  MODO DRY-RUN - Nenhum evento foi removido');
    console.log('Para remover, execute com --apply');
  }

  console.log('');
}

main();

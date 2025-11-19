/**
 * Script para visualizar o impacto da migração de status
 * Execute antes de aplicar a migração real
 *
 * Usage: npx tsx scripts/preview-status-migration.ts
 */

import { PrismaClient } from '@prisma/client';
import { migrateLegacyStatus } from '../lib/shipments/status-migration';
import { ShipmentStatusLabels } from '../lib/shipments/shipment-status';

const prisma = new PrismaClient();

async function previewMigration() {
  console.log('='.repeat(80));
  console.log('PREVIEW: Migração de Status de Shipments');
  console.log('='.repeat(80));
  console.log('');

  // 1. Buscar todos os status distintos atuais
  const currentStatuses = await prisma.$queryRaw<Array<{ status: string; count: number }>>`
    SELECT status, COUNT(*)::int as count
    FROM shipments
    GROUP BY status
    ORDER BY count DESC
  `;

  console.log('📊 STATUS ATUAIS NO BANCO:');
  console.log('');
  console.log('Status Atual'.padEnd(30), '|', 'Quantidade');
  console.log('-'.repeat(50));

  let totalShipments = 0;
  currentStatuses.forEach((row) => {
    console.log(row.status.padEnd(30), '|', row.count);
    totalShipments += row.count;
  });

  console.log('-'.repeat(50));
  console.log('TOTAL'.padEnd(30), '|', totalShipments);
  console.log('');

  // 2. Simular a migração
  console.log('🔄 SIMULAÇÃO DE MIGRAÇÃO:');
  console.log('');
  console.log('Status Antigo'.padEnd(30), '→', 'Status Novo');
  console.log('-'.repeat(80));

  const migrationPreview: Record<string, { newStatus: string; count: number }> = {};

  for (const { status, count } of currentStatuses) {
    // Buscar alguns exemplos desse status para contextualizar
    const samples = await prisma.shipment.findMany({
      where: { status },
      take: 3,
      select: {
        id: true,
        pickupPointId: true,
        pickupRequest: {
          select: {
            status: true,
          },
        },
      },
    });

    // Simular migração com contexto do primeiro exemplo
    const sample = samples[0];
    const newStatus = migrateLegacyStatus(status, {
      pickupPointId: sample?.pickupPointId,
      hasPickupRequest: !!sample?.pickupRequest,
      pickupRequestStatus: sample?.pickupRequest?.status,
    });

    migrationPreview[status] = {
      newStatus,
      count,
    };

    const label = ShipmentStatusLabels[newStatus] || newStatus;
    console.log(
      status.padEnd(30),
      '→',
      `${newStatus} (${label})`.slice(0, 45)
    );
  }

  console.log('-'.repeat(80));
  console.log('');

  // 3. Estatísticas da migração
  console.log('📈 ESTATÍSTICAS DA MIGRAÇÃO:');
  console.log('');

  const newStatusDistribution: Record<string, number> = {};
  Object.values(migrationPreview).forEach(({ newStatus, count }) => {
    newStatusDistribution[newStatus] = (newStatusDistribution[newStatus] || 0) + count;
  });

  console.log('Status Novo'.padEnd(40), '|', 'Quantidade');
  console.log('-'.repeat(60));

  Object.entries(newStatusDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      const label = (status in ShipmentStatusLabels)
        ? ShipmentStatusLabels[status as keyof typeof ShipmentStatusLabels]
        : status;
      console.log(`${status} (${label})`.slice(0, 39).padEnd(40), '|', count);
    });

  console.log('-'.repeat(60));
  console.log('');

  // 4. Identificar possíveis problemas
  console.log('⚠️  ATENÇÃO:');
  console.log('');

  const obsoleteStatuses = ['pending_payment', 'payment_failed', 'ready_for_posting'];
  const foundObsolete = currentStatuses.filter((row) =>
    obsoleteStatuses.includes(row.status)
  );

  if (foundObsolete.length > 0) {
    console.log('❗ Status obsoletos encontrados (serão migrados):');
    foundObsolete.forEach((row) => {
      console.log(`  - ${row.status}: ${row.count} registros`);
    });
    console.log('');
  }

  const unknownStatuses = currentStatuses.filter(
    (row) => !Object.keys(migrationPreview).includes(row.status)
  );

  if (unknownStatuses.length > 0) {
    console.log('⚠️  Status desconhecidos (usar fallback):');
    unknownStatuses.forEach((row) => {
      console.log(`  - ${row.status}: ${row.count} registros`);
    });
    console.log('');
  }

  // 5. Recomendações
  console.log('💡 PRÓXIMOS PASSOS:');
  console.log('');
  console.log('1. Revise a simulação acima');
  console.log('2. Se tudo estiver correto, execute a migração:');
  console.log('   DATABASE_URL="..." npx prisma migrate deploy');
  console.log('');
  console.log('3. Após a migração, execute verificação:');
  console.log('   DATABASE_URL="..." npx tsx scripts/verify-status-migration.ts');
  console.log('');
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

// Executar
previewMigration().catch((error) => {
  console.error('❌ Erro ao preview da migração:', error);
  process.exit(1);
});

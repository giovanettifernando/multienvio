/**
 * Script para verificar a migração de status após aplicação
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/verify-status-migration.ts
 */

import { PrismaClient } from '@prisma/client';
import { ShipmentStatus, ShipmentStatusLabels } from '../lib/shipments/shipment-status';

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('='.repeat(80));
  console.log('VERIFICAÇÃO: Migração de Status de Shipments');
  console.log('='.repeat(80));
  console.log('');

  let hasErrors = false;

  // 1. Verificar status válidos
  console.log('✅ Verificando se todos os status são válidos...');
  console.log('');

  const allStatuses = await prisma.$queryRaw<Array<{ status: string; count: number }>>`
    SELECT status, COUNT(*)::int as count
    FROM shipments
    GROUP BY status
    ORDER BY count DESC
  `;

  const validStatuses = Object.values(ShipmentStatus);
  const invalidStatuses = allStatuses.filter(
    (row) => !validStatuses.includes(row.status as ShipmentStatus)
  );

  if (invalidStatuses.length > 0) {
    hasErrors = true;
    console.log('❌ Status inválidos encontrados:');
    invalidStatuses.forEach((row) => {
      console.log(`  - ${row.status}: ${row.count} registros`);
    });
    console.log('');
  } else {
    console.log('✅ Todos os status são válidos!');
    console.log('');
  }

  // 2. Distribuição final
  console.log('📊 DISTRIBUIÇÃO FINAL DE STATUS:');
  console.log('');
  console.log('Status'.padEnd(50), '|', 'Quantidade');
  console.log('-'.repeat(70));

  let totalShipments = 0;
  allStatuses.forEach((row) => {
    const label = ShipmentStatusLabels[row.status as ShipmentStatus] || row.status;
    const display = `${row.status} (${label})`.slice(0, 49);
    console.log(display.padEnd(50), '|', row.count);
    totalShipments += row.count;
  });

  console.log('-'.repeat(70));
  console.log('TOTAL'.padEnd(50), '|', totalShipments);
  console.log('');

  // 3. Verificar integridade com pickup requests
  console.log('🔗 Verificando integridade com PickupRequests...');
  console.log('');

  const shipmentsWithPickup = await prisma.shipment.count({
    where: {
      pickupRequest: {
        isNot: null,
      },
    },
  });

  const pickupStatuses = [
    ShipmentStatus.PICKUP_REQUESTED,
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
    ShipmentStatus.PICKUP_FAILED,
    ShipmentStatus.COLLECTED_FROM_SENDER,
    ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
  ];

  const shipmentsInPickupStatus = await prisma.shipment.count({
    where: {
      status: {
        in: pickupStatuses,
      },
    },
  });

  console.log(`  Shipments com PickupRequest: ${shipmentsWithPickup}`);
  console.log(`  Shipments em status de coleta: ${shipmentsInPickupStatus}`);
  console.log('');

  // 4. Verificar pontos de coleta
  console.log('📍 Verificando integridade com Pontos de Coleta...');
  console.log('');

  const shipmentsWithPoint = await prisma.shipment.count({
    where: {
      pickupPointId: {
        not: null,
      },
    },
  });

  const pointStatuses = [
    ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
    ShipmentStatus.DROPPED_OFF_AT_POINT,
    ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
    ShipmentStatus.COLLECTED_FROM_POINT,
  ];

  const shipmentsInPointStatus = await prisma.shipment.count({
    where: {
      status: {
        in: pointStatuses,
      },
    },
  });

  console.log(`  Shipments com Ponto de Coleta: ${shipmentsWithPoint}`);
  console.log(`  Shipments em status de ponto: ${shipmentsInPointStatus}`);
  console.log('');

  // 5. Status finais
  console.log('🏁 Verificando status finais...');
  console.log('');

  const finalStatuses = [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
    ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
    ShipmentStatus.RETURNED_TO_SENDER,
    ShipmentStatus.EXPIRED_NOT_POSTED,
  ];

  const shipmentsInFinalStatus = await prisma.shipment.count({
    where: {
      status: {
        in: finalStatuses,
      },
    },
  });

  console.log(`  Shipments em status final: ${shipmentsInFinalStatus} (${((shipmentsInFinalStatus / totalShipments) * 100).toFixed(1)}%)`);
  console.log('');

  // 6. Resumo
  console.log('='.repeat(80));
  if (hasErrors) {
    console.log('❌ VERIFICAÇÃO CONCLUÍDA COM ERROS');
    console.log('');
    console.log('Ação recomendada: Revisar e corrigir os status inválidos encontrados.');
  } else {
    console.log('✅ VERIFICAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('');
    console.log('Todos os status foram migrados corretamente.');
    console.log('A aplicação está pronta para usar o novo padrão de status.');
  }
  console.log('='.repeat(80));

  await prisma.$disconnect();

  process.exit(hasErrors ? 1 : 0);
}

// Executar
verifyMigration().catch((error) => {
  console.error('❌ Erro na verificação:', error);
  process.exit(1);
});

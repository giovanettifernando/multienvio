/**
 * Script para diagnosticar Shipments sem volumes
 * Execução: DATABASE_URL="..." npx tsx scripts/check-shipments-without-volumes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[CHECK] Analisando Shipments sem volumes...\n');

  // Buscar todos os shipments sem volumes (exceto cancelados)
  const shipmentsWithoutVolumes = await prisma.shipment.findMany({
    where: {
      status: {
        not: 'cancelled',
      },
      packages: {
        none: {},
      },
    },
    select: {
      id: true,
      platformTrackingCode: true,
      status: true,
      weight: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`📊 Total de Shipments sem volumes: ${shipmentsWithoutVolumes.length}\n`);

  if (shipmentsWithoutVolumes.length === 0) {
    console.log('✅ Nenhum shipment sem volumes encontrado!');
    return;
  }

  // Agrupar por status
  const byStatus = shipmentsWithoutVolumes.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📈 Agrupamento por Status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });
  console.log('');

  // Mostrar os 10 primeiros
  console.log('🔍 Primeiros 10 registros sem volumes:');
  shipmentsWithoutVolumes.slice(0, 10).forEach((s, idx) => {
    console.log(`\n${idx + 1}. ID: ${s.id}`);
    console.log(`   Tracking: ${s.platformTrackingCode}`);
    console.log(`   Status: ${s.status}`);
    console.log(`   Peso declarado: ${s.weight} kg`);
    console.log(`   Criado em: ${s.createdAt.toISOString()}`);
    console.log(`   Remetente: ${s.sender.name} (${s.sender.id})`);
  });

  console.log('\n⚠️  PROBLEMA IDENTIFICADO:');
  console.log('   Os Shipments estão sendo criados sem criar os Packages associados.');
  console.log('   Endpoints afetados: /api/checkout e /api/cart/checkout');
}

main()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

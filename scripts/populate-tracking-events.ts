import { PrismaClient } from '@prisma/client';
import { createInitialTrackingEvent } from '../lib/tracking/create-event';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Populando eventos de rastreamento para shipments existentes...\n');

  // Buscar todos os shipments SEM eventos
  const shipmentsWithoutEvents = await prisma.shipment.findMany({
    where: {
      trackingEvents: {
        none: {},
      },
    },
    select: {
      id: true,
      platformTrackingCode: true,
      status: true,
      createdAt: true,
    },
  });

  console.log(`📦 Encontrados ${shipmentsWithoutEvents.length} shipments sem eventos\n`);

  if (shipmentsWithoutEvents.length === 0) {
    console.log('✅ Todos os shipments já possuem eventos!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  // Processar cada shipment
  for (const shipment of shipmentsWithoutEvents) {
    try {
      await prisma.$transaction(async (tx) => {
        const event = await createInitialTrackingEvent(
          tx,
          shipment.id,
          shipment.status,
          shipment.createdAt
        );

        console.log(`✅ ${shipment.platformTrackingCode} - ${event.description}`);
      });

      successCount++;
    } catch (error) {
      console.error(`❌ Erro em ${shipment.platformTrackingCode}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Sucesso: ${successCount}`);
  console.log(`   ❌ Erro: ${errorCount}`);
  console.log(`   📦 Total: ${shipmentsWithoutEvents.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

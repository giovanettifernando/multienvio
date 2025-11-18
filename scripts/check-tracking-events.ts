import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando eventos de rastreamento...\n');

  // 1. Contar shipments totais
  const totalShipments = await prisma.shipment.count();
  console.log(`📦 Total de shipments: ${totalShipments}`);

  // 2. Contar eventos totais
  const totalEvents = await prisma.trackingEvent.count();
  console.log(`📊 Total de eventos de rastreamento: ${totalEvents}\n`);

  // 3. Buscar últimos 5 shipments com contagem de eventos
  const shipments = await prisma.shipment.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      platformTrackingCode: true,
      publicTrackingId: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          trackingEvents: true,
        },
      },
    },
  });

  console.log('📋 Últimos 5 shipments:\n');
  for (const shipment of shipments) {
    console.log(`Código: ${shipment.platformTrackingCode}`);
    console.log(`  ID: ${shipment.id}`);
    console.log(`  Public Tracking ID: ${shipment.publicTrackingId || 'N/A'}`);
    console.log(`  Status: ${shipment.status}`);
    console.log(`  Eventos: ${shipment._count.trackingEvents}`);
    console.log(`  Criado em: ${shipment.createdAt.toLocaleString('pt-BR')}`);
    console.log('');
  }

  // 4. Buscar exemplo de shipment com eventos
  const shipmentWithEvents = await prisma.shipment.findFirst({
    where: {
      trackingEvents: {
        some: {},
      },
    },
    include: {
      trackingEvents: {
        orderBy: { occurredAt: 'desc' },
      },
    },
  });

  if (shipmentWithEvents) {
    console.log('✅ Exemplo de shipment COM eventos:\n');
    console.log(`Código: ${shipmentWithEvents.platformTrackingCode}`);
    console.log(`Status: ${shipmentWithEvents.status}`);
    console.log(`Eventos (${shipmentWithEvents.trackingEvents.length}):`);
    shipmentWithEvents.trackingEvents.forEach((event, idx) => {
      console.log(`  ${idx + 1}. [${event.type}] ${event.description}`);
      console.log(`     ${event.occurredAt.toLocaleString('pt-BR')}`);
      if (event.city || event.uf) {
        console.log(`     ${event.city || ''}${event.city && event.uf ? '/' : ''}${event.uf || ''}`);
      }
    });
  } else {
    console.log('⚠️  Nenhum shipment possui eventos de rastreamento.');
  }

  // 5. Buscar shipments SEM eventos
  const shipmentsWithoutEvents = await prisma.shipment.findMany({
    where: {
      trackingEvents: {
        none: {},
      },
    },
    take: 3,
    select: {
      id: true,
      platformTrackingCode: true,
      status: true,
      createdAt: true,
    },
  });

  if (shipmentsWithoutEvents.length > 0) {
    console.log(`\n⚠️  Shipments SEM eventos (${shipmentsWithoutEvents.length}):\n`);
    shipmentsWithoutEvents.forEach((s) => {
      console.log(`  - ${s.platformTrackingCode} (${s.status})`);
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Testando endpoint público de rastreamento...\n');

  // Buscar um shipment com publicTrackingId
  const shipment = await prisma.shipment.findFirst({
    where: {
      publicTrackingId: { not: null },
    },
    select: {
      id: true,
      platformTrackingCode: true,
      publicTrackingId: true,
      status: true,
      trackingEvents: {
        orderBy: { occurredAt: 'desc' },
      },
    },
  });

  if (!shipment) {
    console.log('❌ Nenhum shipment com publicTrackingId encontrado');
    return;
  }

  console.log(`📦 Shipment: ${shipment.platformTrackingCode}`);
  console.log(`🔗 Public ID: ${shipment.publicTrackingId}`);
  console.log(`📊 Status: ${shipment.status}`);
  console.log(`📅 Eventos: ${shipment.trackingEvents.length}\n`);

  if (shipment.trackingEvents.length > 0) {
    console.log('Eventos de rastreamento:');
    shipment.trackingEvents.forEach((event, idx) => {
      console.log(`  ${idx + 1}. [${event.type}] ${event.description}`);
      console.log(`     ${event.occurredAt.toLocaleString('pt-BR')}`);
    });
  }

  // Simular chamada ao endpoint público
  console.log(`\n🌐 URL pública: /rastreio/${shipment.publicTrackingId}`);
  console.log(`🌐 API pública: /api/public/track/${shipment.publicTrackingId}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

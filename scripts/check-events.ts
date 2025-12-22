import { prisma } from './lib/db';

async function main() {
  const shipment = await prisma.shipment.findFirst({
    where: { platformTrackingCode: 'EL17659178757118QXHB' },
    include: {
      trackingEvents: {
        orderBy: { occurredAt: 'asc' }
      }
    }
  });

  if (!shipment) {
    console.log('Shipment não encontrado');
    return;
  }

  console.log('Eventos de rastreamento:');
  console.log('========================');
  for (const e of shipment.trackingEvents) {
    const city = e.city || '';
    const uf = e.uf || '';
    console.log('[' + e.type + '] ' + e.description + ' - ' + city + '/' + uf + ' - ' + e.occurredAt.toISOString());
  }

  console.log('\nStatus atual:', shipment.status);
  console.log('postedAt:', shipment.postedAt ? shipment.postedAt.toISOString() : 'null');
}

main();

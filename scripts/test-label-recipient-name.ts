/**
 * Script de validação para verificar se recipientName está correto em Labels
 */

import { prisma } from '../lib/db';

async function testLabelRecipientName() {
  console.log('🧪 Teste de recipientName em Labels\n');

  // Buscar todas as labels com seus shipments
  const labels = await prisma.label.findMany({
    include: {
      shipment: {
        select: {
          id: true,
          trackingCode: true,
          recipientName: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`📦 Total de labels: ${labels.length}\n`);

  let ok = 0;
  let missing = 0;
  let mismatch = 0;

  for (const label of labels) {
    const hasLabelName = !!label.recipientName;
    const hasShipmentName = !!label.shipment.recipientName;
    const namesMatch = label.recipientName === label.shipment.recipientName;

    console.log(`Label ${label.id}:`);
    console.log(`  Tracking: ${label.shipment.trackingCode}`);
    console.log(`  Shipment status: ${label.shipment.status}`);
    console.log(`  Label recipientName: ${label.recipientName || 'NULL'}`);
    console.log(`  Shipment recipientName: ${label.shipment.recipientName || 'NULL'}`);

    if (!hasLabelName && !hasShipmentName) {
      console.log(`  ⚠️  Ambos sem recipientName`);
      missing++;
    } else if (!hasLabelName && hasShipmentName) {
      console.log(`  ❌ Label sem recipientName, mas shipment tem`);
      mismatch++;
    } else if (hasLabelName && !namesMatch) {
      console.log(`  ⚠️  Nomes não batem`);
      mismatch++;
    } else {
      console.log(`  ✅ OK`);
      ok++;
    }
    console.log('');
  }

  console.log('📈 Resumo:');
  console.log(`  ✅ Corretos: ${ok}`);
  console.log(`  ❌ Com problemas: ${mismatch}`);
  console.log(`  ⚠️  Sem dados: ${missing}`);

  // Verificar filtro de cancelados
  console.log('\n🔍 Verificando filtro de cancelados...\n');

  const cancelledShipments = await prisma.shipment.findMany({
    where: {
      status: { in: ['cancelled', 'failed'] },
    },
    include: {
      label: true,
    },
  });

  console.log(`📦 Shipments cancelados/falhos: ${cancelledShipments.length}`);

  if (cancelledShipments.length > 0) {
    console.log('⚠️  Há shipments cancelados - a API deve filtrá-los');
  } else {
    console.log('✅ Nenhum shipment cancelado no momento');
  }
}

// Executar
testLabelRecipientName()
  .catch((error) => {
    console.error('💥 Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

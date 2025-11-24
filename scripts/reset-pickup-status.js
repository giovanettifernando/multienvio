const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetPickupStatus() {
  const trackingCode = 'BR1763747553870FE9YB';

  try {
    console.log(`Procurando shipment com código: ${trackingCode}...`);

    // Buscar shipment e pickup request
    const shipment = await prisma.shipment.findUnique({
      where: { platformTrackingCode: trackingCode },
      include: {
        pickupRequest: true,
      },
    });

    if (!shipment) {
      console.log('❌ Shipment não encontrado');
      return;
    }

    console.log('\n📦 Shipment encontrado:');
    console.log(`  ID: ${shipment.id}`);
    console.log(`  Status atual: ${shipment.status}`);

    if (!shipment.pickupRequest) {
      console.log('❌ Nenhuma pickup request associada');
      return;
    }

    console.log('\n📋 Pickup Request atual:');
    console.log(`  ID: ${shipment.pickupRequest.id}`);
    console.log(`  Status: ${shipment.pickupRequest.status}`);
    console.log(`  Coletada em: ${shipment.pickupRequest.collectedAt}`);
    console.log(`  Entregue na transportadora: ${shipment.pickupRequest.deliveredToCarrierAt}`);

    // Atualizar para status "antes de entregar na transportadora"
    console.log('\n🔄 Revertendo para status COLLECTED (antes de entregar na transportadora)...');

    await prisma.$transaction(async (tx) => {
      // Atualizar PickupRequest: status COLLECTED e limpar deliveredToCarrierAt
      await tx.pickupRequest.update({
        where: { id: shipment.pickupRequest.id },
        data: {
          status: 'COLLECTED',
          deliveredToCarrierAt: null,
          carrierRecipient: null,
          carrierUnit: null,
        },
      });

      // Atualizar Shipment para status correspondente
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: 'awaiting_drop_off_at_point',
        },
      });
    });

    console.log('\n✅ Status revertido com sucesso!');
    console.log('   Pickup Request: COLLECTED (sem data de entrega na transportadora)');
    console.log('   Shipment: awaiting_drop_off_at_point');
    console.log('\n   Agora você pode testar a funcionalidade de "Registrar entrega na transportadora"');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPickupStatus();

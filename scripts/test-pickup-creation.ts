/**
 * Script de teste para validar criação de PickupRequest com dados corretos
 */

import { prisma } from '../lib/db';

async function testPickupCreation() {
  console.log('🧪 Teste de criação de PickupRequest\n');

  // Buscar um shipment existente para teste
  const shipment = await prisma.shipment.findFirst({
    where: {
      status: { not: 'cancelled' },
    },
    select: {
      id: true,
      platformTrackingCode: true,
      originCep: true,
      destinationCity: true,
      destinationState: true,
      senderId: true,
      pickupRequest: true,
    },
  });

  if (!shipment) {
    console.log('❌ Nenhum shipment encontrado para teste');
    return;
  }

  console.log('📦 Shipment encontrado:');
  console.log(`  ID: ${shipment.id}`);
  console.log(`  Tracking: ${shipment.platformTrackingCode}`);
  console.log(`  Origin CEP: ${shipment.originCep}`);
  console.log(`  Destination: ${shipment.destinationCity}/${shipment.destinationState}\n`);

  if (shipment.pickupRequest) {
    console.log('📋 Pickup Request existente:');
    console.log(`  ID: ${shipment.pickupRequest.id}`);
    console.log(`  Origin CEP: ${shipment.pickupRequest.originCep}`);
    console.log(`  Origin City: ${shipment.pickupRequest.originCity || 'NULL'}`);
    console.log(`  Origin UF: ${shipment.pickupRequest.originUf || 'NULL'}`);
    console.log(`  Status: ${shipment.pickupRequest.status}\n`);

    // Validar consistência
    if (shipment.pickupRequest.originCity && shipment.pickupRequest.originUf) {
      const destMatch =
        shipment.pickupRequest.originCity === shipment.destinationCity &&
        shipment.pickupRequest.originUf === shipment.destinationState;

      if (destMatch) {
        console.log('⚠️  PROBLEMA: Pickup está com dados de DESTINO em vez de ORIGEM!');
        console.log(`  Esperado: Dados de origem (CEP ${shipment.originCep})`);
        console.log(`  Atual: ${shipment.pickupRequest.originCity}/${shipment.pickupRequest.originUf} (destino)`);
      } else {
        console.log('✅ Pickup parece estar correto (não é destino)');
      }
    } else {
      console.log('⚠️  Pickup sem cidade/UF - necessita backfill');
    }
  } else {
    console.log('ℹ️  Shipment não tem pickup request associado');
  }

  // Listar todos os pickups e verificar consistência
  console.log('\n📊 Verificando todos os pickups...\n');

  const allPickups = await prisma.pickupRequest.findMany({
    include: {
      shipment: {
        select: {
          originCep: true,
          destinationCity: true,
          destinationState: true,
        },
      },
    },
    take: 10,
  });

  console.log(`Total de pickups: ${allPickups.length}\n`);

  let issues = 0;
  let ok = 0;
  let missing = 0;

  for (const pickup of allPickups) {
    const hasDestData =
      pickup.originCity === pickup.shipment.destinationCity &&
      pickup.originUf === pickup.shipment.destinationState;

    if (!pickup.originCity || !pickup.originUf) {
      console.log(`⚠️  ${pickup.id}: Sem cidade/UF (CEP: ${pickup.originCep})`);
      missing++;
    } else if (hasDestData) {
      console.log(`❌ ${pickup.id}: Dados de DESTINO! ${pickup.originCity}/${pickup.originUf}`);
      issues++;
    } else {
      console.log(`✅ ${pickup.id}: ${pickup.originCity}/${pickup.originUf}`);
      ok++;
    }
  }

  console.log('\n📈 Resumo:');
  console.log(`  ✅ Corretos: ${ok}`);
  console.log(`  ❌ Com dados de destino: ${issues}`);
  console.log(`  ⚠️  Sem cidade/UF: ${missing}`);
}

testPickupCreation()
  .catch((error) => {
    console.error('💥 Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

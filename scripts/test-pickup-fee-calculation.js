// Script para testar cálculo de taxa de coleta
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Função Haversine para calcular distância (mesma do lib/utils/geo.ts)
function calculateDistance(coord1, coord2) {
  const R = 6371; // Earth radius in km

  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

async function testPickupFeeCalculation() {
  console.log('\n=== Teste de Cálculo de Taxa de Coleta ===\n');

  try {
    // Cenário de teste: origem em João Pessoa
    const originCoords = {
      lat: -7.1195,
      lng: -34.845,
    };

    console.log('📍 Origem de teste:');
    console.log(`   João Pessoa/PB: ${originCoords.lat}, ${originCoords.lng}\n`);

    // Buscar todos os coletores ativos
    const collectors = await prisma.collector.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        pfNome: true,
        pjRazaoSocial: true,
        pfCidade: true,
        pfUf: true,
        pjCidade: true,
        pjUf: true,
        pfGeo: true,
        pjGeo: true,
        pickupFeeType: true,
        pickupFixedFee: true,
        pickupFeePerKm: true,
      },
    });

    console.log(`📊 Coletores ativos encontrados: ${collectors.length}\n`);

    if (collectors.length === 0) {
      console.log('⚠️  Nenhum coletor ativo encontrado. Cadastre coletores em /admin/coletores.\n');
      return;
    }

    const collectorsWithDistance = [];

    for (const collector of collectors) {
      let collectorCoords = null;

      // Tentar PF primeiro, depois PJ
      if (
        collector.pfGeo &&
        typeof collector.pfGeo === 'object' &&
        'lat' in collector.pfGeo &&
        'lng' in collector.pfGeo
      ) {
        collectorCoords = {
          lat: collector.pfGeo.lat,
          lng: collector.pfGeo.lng,
        };
      } else if (
        collector.pjGeo &&
        typeof collector.pjGeo === 'object' &&
        'lat' in collector.pjGeo &&
        'lng' in collector.pjGeo
      ) {
        collectorCoords = {
          lat: collector.pjGeo.lat,
          lng: collector.pjGeo.lng,
        };
      }

      if (!collectorCoords) {
        console.log(`⚠️  ${collector.pfNome}: SEM coordenadas válidas - ignorado\n`);
        continue;
      }

      const distance = calculateDistance(originCoords, collectorCoords);

      let feeAmount = 0;
      if (collector.pickupFeeType === 'FIXED') {
        feeAmount = collector.pickupFixedFee ?? 0;
      } else if (collector.pickupFeeType === 'PER_KM') {
        feeAmount = distance * (collector.pickupFeePerKm ?? 0);
      }

      collectorsWithDistance.push({
        ...collector,
        coords: collectorCoords,
        distance,
        feeAmount,
      });

      console.log(`🚗 ${collector.pfNome} (${collector.pjRazaoSocial})`);
      console.log(`   Localização: ${collector.pfCidade || collector.pjCidade}/${collector.pfUf || collector.pjUf}`);
      console.log(`   Coordenadas: ${collectorCoords.lat}, ${collectorCoords.lng}`);
      console.log(`   📏 Distância da origem: ${distance.toFixed(1)} km`);
      console.log(`   💰 Tipo de taxa: ${collector.pickupFeeType}`);

      if (collector.pickupFeeType === 'FIXED') {
        console.log(`   💵 Taxa fixa: ${currency.format(collector.pickupFixedFee ?? 0)}`);
      } else {
        console.log(`   💵 Taxa por km: ${currency.format(collector.pickupFeePerKm ?? 0)}/km`);
        console.log(
          `   💵 Taxa calculada: ${currency.format(feeAmount)} (${distance.toFixed(1)} km × ${currency.format(collector.pickupFeePerKm ?? 0)})`
        );
      }

      console.log('');
    }

    if (collectorsWithDistance.length === 0) {
      console.log('❌ Nenhum coletor com coordenadas válidas!\n');
      console.log('Execute o script de geocodificação: node scripts/geocode-collectors.js\n');
      return;
    }

    // Ordenar por distância
    collectorsWithDistance.sort((a, b) => a.distance - b.distance);

    const nearest = collectorsWithDistance[0];

    console.log('=== RESULTADO ===');
    console.log(`🏆 Coletor mais próximo: ${nearest.pfNome} (${nearest.pjRazaoSocial})`);
    console.log(`📏 Distância: ${nearest.distance.toFixed(1)} km`);
    console.log(`💰 Tipo de taxa: ${nearest.pickupFeeType}`);
    console.log(`💵 Taxa de coleta: ${currency.format(nearest.feeAmount)}`);
    console.log('');

    // Simular frete + coleta
    const freightCost = 50.0;
    const totalWithPickup = freightCost + nearest.feeAmount;

    console.log('=== SIMULAÇÃO DE COTAÇÃO ===');
    console.log(`Frete: ${currency.format(freightCost)}`);
    console.log(`Taxa de coleta: ${currency.format(nearest.feeAmount)}`);
    console.log(`Total: ${currency.format(totalWithPickup)}`);
    console.log('');
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPickupFeeCalculation();

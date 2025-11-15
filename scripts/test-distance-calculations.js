// Script para testar cálculo de distâncias com geocodificação real
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Função de geocodificação (mesma lógica do backend)
async function geocodeCEP(cep) {
  const cleanCep = cep.replace(/\D/g, '');

  if (cleanCep.length !== 8) {
    return { success: false, error: 'CEP inválido' };
  }

  try {
    // 1. Buscar dados do CEP usando BrasilAPI
    const cepResponse = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);

    if (!cepResponse.ok) {
      return { success: false, error: 'CEP não encontrado' };
    }

    const cepData = await cepResponse.json();

    // 2. Construir endereço completo para geocodificação
    const addressParts = [
      cepData.street,
      cepData.neighborhood,
      cepData.city,
      cepData.state,
      'Brazil',
    ].filter(Boolean);

    const address = addressParts.join(', ');

    // 3. Geocodificar usando Nominatim (OpenStreetMap)
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Envio Legal App (distance test)',
      },
    });

    if (!nominatimResponse.ok) {
      return { success: false, error: 'Erro ao geocodificar' };
    }

    const nominatimData = await nominatimResponse.json();

    if (!nominatimData || nominatimData.length === 0) {
      return { success: false, error: 'Coordenadas não encontradas' };
    }

    const coordinates = {
      lat: parseFloat(nominatimData[0].lat),
      lng: parseFloat(nominatimData[0].lon),
    };

    return { success: true, coordinates };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Função Haversine para calcular distância
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

function formatDistance(distanceKm) {
  if (distanceKm === undefined || distanceKm === null) return '—';
  if (distanceKm < 1) return '< 1 km';
  return `${distanceKm.toFixed(1)} km`;
}

async function testDistanceCalculations() {
  console.log('\n=== Teste de Cálculo de Distâncias ===\n');

  try {
    // CEP de origem do teste
    const originCep = '58035-100'; // João Pessoa/PB (do bug report do usuário)

    console.log(`📍 Origem: CEP ${originCep}`);
    console.log('🌐 Geocodificando origem...\n');

    const originResult = await geocodeCEP(originCep);

    if (!originResult.success) {
      console.log(`❌ Erro ao geocodificar origem: ${originResult.error}`);
      return;
    }

    const originCoords = originResult.coordinates;
    console.log(`✅ Origem geocodificada: ${originCoords.lat}, ${originCoords.lng}\n`);
    console.log('---\n');

    // Buscar todos os pontos de coleta
    const points = await prisma.pickupPoint.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        nomeFantasia: true,
        cidade: true,
        uf: true,
        cep: true,
        geo: true,
      },
    });

    console.log(`📊 Pontos de coleta encontrados: ${points.length}\n`);

    for (const point of points) {
      console.log(`\n🏢 ${point.nomeFantasia}`);
      console.log(`   Localização: ${point.cidade}/${point.uf}`);
      console.log(`   CEP: ${point.cep || 'Não cadastrado'}`);

      const geo = point.geo;
      if (geo && typeof geo === 'object' && 'lat' in geo && 'lng' in geo) {
        console.log(`   Coordenadas: ${geo.lat}, ${geo.lng}`);

        const distance = calculateDistance(originCoords, { lat: geo.lat, lng: geo.lng });
        console.log(`   📏 Distância da origem: ${formatDistance(distance)}`);
      } else {
        console.log('   ⚠️  Sem coordenadas');
      }
    }

    console.log('\n---\n');

    // Comparar com coordenadas de capital (modo antigo)
    const capitalCoords = { lat: -7.1195, lng: -34.845 }; // João Pessoa capital
    console.log('🔍 Comparação com método antigo (coordenadas da capital):\n');

    for (const point of points) {
      const geo = point.geo;
      if (geo && typeof geo === 'object' && 'lat' in geo && 'lng' in geo) {
        const distanceOld = calculateDistance(capitalCoords, { lat: geo.lat, lng: geo.lng });
        const distanceNew = calculateDistance(originCoords, { lat: geo.lat, lng: geo.lng });

        console.log(`${point.nomeFantasia}:`);
        console.log(`   Método antigo (capital): ${formatDistance(distanceOld)}`);
        console.log(`   Método novo (CEP real): ${formatDistance(distanceNew)}`);
        console.log(`   Diferença: ${Math.abs(distanceNew - distanceOld).toFixed(1)} km\n`);
      }
    }

    console.log('✅ Teste concluído!\n');
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDistanceCalculations();

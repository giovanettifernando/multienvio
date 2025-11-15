// Script para geocodificar todos os pontos de coleta sem coordenadas
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Simular a função geocodeCEP (copiar lógica de lib/services/geocoding.ts)
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
        'User-Agent': 'Envio Legal App (geocoding script)',
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

async function geocodeAllPoints() {
  console.log('\n=== Geocodificando pontos de coleta sem coordenadas ===\n');

  try {
    // Buscar todos os pontos de coleta
    const allPoints = await prisma.pickupPoint.findMany({
      select: {
        id: true,
        nomeFantasia: true,
        cidade: true,
        uf: true,
        cep: true,
        geo: true,
      },
    });

    console.log(`📊 Total de pontos: ${allPoints.length}\n`);

    // Filtrar pontos sem coordenadas válidas
    const pointsWithoutGeo = allPoints.filter((point) => {
      const geo = point.geo;
      const hasValidGeo =
        geo &&
        typeof geo === 'object' &&
        'lat' in geo &&
        'lng' in geo &&
        typeof geo.lat === 'number' &&
        typeof geo.lng === 'number';
      return !hasValidGeo;
    });

    console.log(`📍 Pontos sem coordenadas: ${pointsWithoutGeo.length}\n`);

    if (pointsWithoutGeo.length === 0) {
      console.log('✅ Todos os pontos já possuem coordenadas!\n');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const point of pointsWithoutGeo) {
      console.log(`\n🔍 Processando: ${point.nomeFantasia} (${point.cidade}/${point.uf})`);

      if (!point.cep) {
        console.log('   ⚠️  CEP não cadastrado - pulando');
        failCount++;
        continue;
      }

      console.log(`   📮 CEP: ${point.cep}`);
      console.log('   🌐 Geocodificando...');

      const result = await geocodeCEP(point.cep);

      if (result.success && result.coordinates) {
        // Atualizar no banco
        await prisma.pickupPoint.update({
          where: { id: point.id },
          data: { geo: result.coordinates },
        });

        console.log(`   ✅ Geocodificado: ${result.coordinates.lat}, ${result.coordinates.lng}`);
        successCount++;
      } else {
        console.log(`   ❌ Falha: ${result.error}`);
        failCount++;
      }

      // Aguardar 1 segundo entre requisições para evitar rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('\n=== Resumo ===');
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Falhas: ${failCount}`);
    console.log(`📊 Total processado: ${pointsWithoutGeo.length}\n`);
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

geocodeAllPoints();

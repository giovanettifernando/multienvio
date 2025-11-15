// Script para geocodificar coletores sem coordenadas
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
        'User-Agent': 'Envio Legal App (collector geocoding script)',
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

async function geocodeCollectors() {
  console.log('\n=== Geocodificando Coletores ===\n');

  try {
    // Buscar todos os coletores
    const collectors = await prisma.collector.findMany({
      select: {
        id: true,
        status: true,
        pfNome: true,
        pjRazaoSocial: true,
        pfCep: true,
        pfCidade: true,
        pfUf: true,
        pfGeo: true,
        pjCep: true,
        pjCidade: true,
        pjUf: true,
        pjGeo: true,
      },
    });

    console.log(`📊 Total de coletores: ${collectors.length}\n`);

    // Filtrar coletores sem coordenadas válidas
    const collectorsWithoutGeo = collectors.filter((collector) => {
      const pfGeo = collector.pfGeo;
      const pjGeo = collector.pjGeo;

      const hasPfGeo =
        pfGeo &&
        typeof pfGeo === 'object' &&
        'lat' in pfGeo &&
        'lng' in pfGeo &&
        typeof pfGeo.lat === 'number' &&
        typeof pfGeo.lng === 'number';

      const hasPjGeo =
        pjGeo &&
        typeof pjGeo === 'object' &&
        'lat' in pjGeo &&
        'lng' in pjGeo &&
        typeof pjGeo.lat === 'number' &&
        typeof pjGeo.lng === 'number';

      return !hasPfGeo && !hasPjGeo;
    });

    console.log(`📍 Coletores sem coordenadas: ${collectorsWithoutGeo.length}\n`);

    if (collectorsWithoutGeo.length === 0) {
      console.log('✅ Todos os coletores já possuem coordenadas!\n');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const collector of collectorsWithoutGeo) {
      console.log(`\n🔍 Processando: ${collector.pfNome} (${collector.pjRazaoSocial})`);

      let updated = false;

      // Tentar geocodificar endereço PF
      if (collector.pfCep) {
        console.log(`   📮 CEP PF: ${collector.pfCep}`);
        console.log('   🌐 Geocodificando PF...');

        const result = await geocodeCEP(collector.pfCep);

        if (result.success && result.coordinates) {
          await prisma.collector.update({
            where: { id: collector.id },
            data: { pfGeo: result.coordinates },
          });

          console.log(
            `   ✅ PF geocodificado: ${result.coordinates.lat}, ${result.coordinates.lng}`
          );
          updated = true;
        } else {
          console.log(`   ❌ Falha PF: ${result.error}`);
        }
      } else {
        console.log('   ⚠️  CEP PF não cadastrado - pulando');
      }

      // Aguardar 1 segundo para evitar rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Tentar geocodificar endereço PJ
      if (collector.pjCep) {
        console.log(`   📮 CEP PJ: ${collector.pjCep}`);
        console.log('   🌐 Geocodificando PJ...');

        const result = await geocodeCEP(collector.pjCep);

        if (result.success && result.coordinates) {
          await prisma.collector.update({
            where: { id: collector.id },
            data: { pjGeo: result.coordinates },
          });

          console.log(
            `   ✅ PJ geocodificado: ${result.coordinates.lat}, ${result.coordinates.lng}`
          );
          updated = true;
        } else {
          console.log(`   ❌ Falha PJ: ${result.error}`);
        }
      } else {
        console.log('   ⚠️  CEP PJ não cadastrado - pulando');
      }

      if (updated) {
        successCount++;
      } else {
        failCount++;
      }

      // Aguardar 1 segundo entre coletores
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('\n=== Resumo ===');
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Falhas: ${failCount}`);
    console.log(`📊 Total processado: ${collectorsWithoutGeo.length}\n`);
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

geocodeCollectors();

// Script para geocodificar pontos de coleta usando API do ViaCEP + OpenStreetMap Nominatim
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Função para buscar coordenadas do CEP usando ViaCEP + Nominatim
async function geocodeCEP(cep) {
  try {
    // 1. Buscar dados do CEP no ViaCEP
    const cleanCep = cep.replace(/\D/g, '');
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

    if (!viaCepResponse.ok) {
      throw new Error('Erro ao buscar CEP no ViaCEP');
    }

    const viaCepData = await viaCepResponse.json();

    if (viaCepData.erro) {
      throw new Error(`CEP ${cep} não encontrado`);
    }

    // 2. Construir endereço completo para geocodificação
    const address = [
      viaCepData.logradouro,
      viaCepData.bairro,
      viaCepData.localidade,
      viaCepData.uf,
      'Brazil'
    ].filter(Boolean).join(', ');

    console.log(`   Endereço: ${address}`);

    // 3. Geocodificar usando Nominatim (OpenStreetMap)
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

    // Aguardar 1 segundo para respeitar rate limit do Nominatim
    await new Promise(resolve => setTimeout(resolve, 1000));

    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Envio Legal Geocoding Script'
      }
    });

    if (!nominatimResponse.ok) {
      throw new Error('Erro ao geocodificar endereço');
    }

    const nominatimData = await nominatimResponse.json();

    if (!nominatimData || nominatimData.length === 0) {
      // Fallback: tentar apenas com cidade/UF
      const simplifiedAddress = `${viaCepData.localidade}, ${viaCepData.uf}, Brazil`;
      console.log(`   Tentando endereço simplificado: ${simplifiedAddress}`);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const fallbackResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplifiedAddress)}&limit=1`,
        {
          headers: {
            'User-Agent': 'Envio Legal Geocoding Script'
          }
        }
      );

      const fallbackData = await fallbackResponse.json();

      if (!fallbackData || fallbackData.length === 0) {
        throw new Error('Não foi possível geocodificar o endereço');
      }

      return {
        lat: parseFloat(fallbackData[0].lat),
        lng: parseFloat(fallbackData[0].lon),
      };
    }

    return {
      lat: parseFloat(nominatimData[0].lat),
      lng: parseFloat(nominatimData[0].lon),
    };

  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}`);
    return null;
  }
}

async function geocodePickupPoints() {
  console.log('\n=== Geocodificação de Pontos de Coleta ===\n');

  try {
    // Buscar todos os pontos ativos com CEP
    const allPoints = await prisma.pickupPoint.findMany({
      where: {
        status: 'ACTIVE',
        cep: {
          not: null,
        },
      },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        cep: true,
        cidade: true,
        uf: true,
        geo: true,
      },
    });

    // Filtrar apenas os que não têm coordenadas
    const points = allPoints.filter(p => {
      return !p.geo || typeof p.geo !== 'object' || !('lat' in p.geo) || !('lng' in p.geo);
    });

    if (points.length === 0) {
      console.log('✅ Todos os pontos ativos já possuem coordenadas!');
      return;
    }

    console.log(`Encontrados ${points.length} ponto(s) para geocodificar\n`);

    let success = 0;
    let failed = 0;

    for (const point of points) {
      console.log(`\n[${point.nomeFantasia || point.razaoSocial}]`);
      console.log(`   CEP: ${point.cep}`);
      console.log(`   Cidade/UF: ${point.cidade}/${point.uf}`);
      console.log(`   Geocodificando...`);

      const coords = await geocodeCEP(point.cep);

      if (coords) {
        // Atualizar no banco
        await prisma.pickupPoint.update({
          where: { id: point.id },
          data: {
            geo: coords,
          },
        });

        console.log(`   ✅ Coordenadas salvas: lat=${coords.lat}, lng=${coords.lng}`);
        success++;
      } else {
        console.log(`   ❌ Falha na geocodificação`);
        failed++;
      }
    }

    console.log('\n--- Resumo ---');
    console.log(`✅ Geocodificados com sucesso: ${success}`);
    console.log(`❌ Falhas: ${failed}`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

geocodePickupPoints();

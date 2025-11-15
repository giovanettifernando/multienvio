// Script para testar pontos de coleta e verificar geolocalização
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPickupPointsGeo() {
  console.log('\n=== Testando Pontos de Coleta - Geolocalização ===\n');

  try {
    // Buscar todos os pontos de coleta ativos
    const points = await prisma.pickupPoint.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        cidade: true,
        uf: true,
        cep: true,
        geo: true,
      },
    });

    console.log(`Total de pontos ativos: ${points.length}\n`);

    if (points.length === 0) {
      console.log('⚠️  Nenhum ponto de coleta ativo encontrado.');
      return;
    }

    // Analisar cada ponto
    let withGeo = 0;
    let withoutGeo = 0;

    points.forEach((point, index) => {
      const geo = point.geo;
      const hasValidGeo = geo && typeof geo === 'object' &&
                          'lat' in geo && 'lng' in geo &&
                          typeof geo.lat === 'number' && typeof geo.lng === 'number';

      console.log(`\n[${index + 1}] ${point.nomeFantasia || point.razaoSocial}`);
      console.log(`   Cidade/UF: ${point.cidade}/${point.uf}`);
      console.log(`   CEP: ${point.cep || 'não informado'}`);
      console.log(`   Geo: ${JSON.stringify(geo)}`);
      console.log(`   ✓ Coordenadas válidas? ${hasValidGeo ? '✅ SIM' : '❌ NÃO'}`);

      if (hasValidGeo) {
        withGeo++;
      } else {
        withoutGeo++;
      }
    });

    console.log('\n--- Resumo ---');
    console.log(`✅ Com coordenadas válidas: ${withGeo}`);
    console.log(`❌ Sem coordenadas válidas: ${withoutGeo}`);

    if (withoutGeo > 0) {
      console.log('\n⚠️  PROBLEMA IDENTIFICADO:');
      console.log(`   ${withoutGeo} ponto(s) não tem coordenadas (lat/lng) válidas.`);
      console.log('   Solução: Use o painel admin para geocodificar os endereços.');
    } else {
      console.log('\n✅ Todos os pontos têm coordenadas válidas!');
      console.log('   O problema pode estar na conversão dos dados para o mapa.');
    }

  } catch (error) {
    console.error('Erro ao buscar pontos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPickupPointsGeo();

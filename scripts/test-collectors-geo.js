// Script para diagnosticar coletores e verificar coordenadas
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCollectorsGeo() {
  console.log('\n=== Testando Coletores - Geolocalização ===\n');

  try {
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
        pickupFeeType: true,
        pickupFixedFee: true,
        pickupFeePerKm: true,
      },
    });

    console.log(`Total de coletores: ${collectors.length}\n`);

    const activeCollectors = collectors.filter((c) => c.status === 'ACTIVE');
    console.log(`Coletores ativos: ${activeCollectors.length}\n`);

    collectors.forEach((collector, index) => {
      console.log(`\n[${index + 1}] ${collector.pfNome} (${collector.pjRazaoSocial})`);
      console.log(`   Status: ${collector.status}`);
      console.log(`   PF: ${collector.pfCidade}/${collector.pfUf} - CEP ${collector.pfCep || 'N/A'}`);
      console.log(`   PJ: ${collector.pjCidade}/${collector.pjUf} - CEP ${collector.pjCep || 'N/A'}`);

      // Verificar coordenadas PF
      const hasPfGeo =
        collector.pfGeo &&
        typeof collector.pfGeo === 'object' &&
        'lat' in collector.pfGeo &&
        'lng' in collector.pfGeo &&
        typeof collector.pfGeo.lat === 'number' &&
        typeof collector.pfGeo.lng === 'number';

      if (hasPfGeo) {
        console.log(`   ✓ Coordenadas PF válidas: ${collector.pfGeo.lat}, ${collector.pfGeo.lng}`);
      } else {
        console.log(`   ❌ Coordenadas PF inválidas ou ausentes`);
      }

      // Verificar coordenadas PJ
      const hasPjGeo =
        collector.pjGeo &&
        typeof collector.pjGeo === 'object' &&
        'lat' in collector.pjGeo &&
        'lng' in collector.pjGeo &&
        typeof collector.pjGeo.lat === 'number' &&
        typeof collector.pjGeo.lng === 'number';

      if (hasPjGeo) {
        console.log(`   ✓ Coordenadas PJ válidas: ${collector.pjGeo.lat}, ${collector.pjGeo.lng}`);
      } else {
        console.log(`   ❌ Coordenadas PJ inválidas ou ausentes`);
      }

      // Verificar taxa de coleta
      console.log(`   Taxa de coleta: ${collector.pickupFeeType}`);
      if (collector.pickupFeeType === 'FIXED') {
        console.log(`     Valor fixo: R$ ${collector.pickupFixedFee?.toFixed(2) || '0.00'}`);
      } else if (collector.pickupFeeType === 'PER_KM') {
        console.log(`     Valor por km: R$ ${collector.pickupFeePerKm?.toFixed(2) || '0.00'}`);
      }

      // Verificar se tem pelo menos uma coordenada válida
      const hasAnyGeo = hasPfGeo || hasPjGeo;
      if (collector.status === 'ACTIVE' && !hasAnyGeo) {
        console.log(`   ⚠️  ATENÇÃO: Coletor ativo mas SEM coordenadas válidas!`);
      }
    });

    // Resumo
    console.log('\n--- Resumo ---');
    const withPfGeo = collectors.filter((c) => {
      const geo = c.pfGeo;
      return (
        geo &&
        typeof geo === 'object' &&
        'lat' in geo &&
        'lng' in geo &&
        typeof geo.lat === 'number' &&
        typeof geo.lng === 'number'
      );
    });

    const withPjGeo = collectors.filter((c) => {
      const geo = c.pjGeo;
      return (
        geo &&
        typeof geo === 'object' &&
        'lat' in geo &&
        'lng' in geo &&
        typeof geo.lat === 'number' &&
        typeof geo.lng === 'number'
      );
    });

    const withAnyGeo = collectors.filter((c) => {
      const pfGeo = c.pfGeo;
      const pjGeo = c.pjGeo;
      const hasPf =
        pfGeo &&
        typeof pfGeo === 'object' &&
        'lat' in pfGeo &&
        'lng' in pfGeo &&
        typeof pfGeo.lat === 'number' &&
        typeof pfGeo.lng === 'number';
      const hasPj =
        pjGeo &&
        typeof pjGeo === 'object' &&
        'lat' in pjGeo &&
        'lng' in pjGeo &&
        typeof pjGeo.lat === 'number' &&
        typeof pjGeo.lng === 'number';
      return hasPf || hasPj;
    });

    console.log(`✅ Com coordenadas PF válidas: ${withPfGeo.length}`);
    console.log(`✅ Com coordenadas PJ válidas: ${withPjGeo.length}`);
    console.log(`✅ Com pelo menos uma coordenada válida: ${withAnyGeo.length}`);
    console.log(`❌ Sem coordenadas válidas: ${collectors.length - withAnyGeo.length}\n`);

    if (withAnyGeo.length === collectors.length) {
      console.log('✅ Todos os coletores têm coordenadas válidas!\n');
    } else {
      console.log(
        `⚠️  Alguns coletores precisam de geocodificação. Execute o script de geocodificação.\n`
      );
    }
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCollectorsGeo();

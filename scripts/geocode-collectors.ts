/**
 * Script para geocodificar CEPs de coletores
 *
 * NOVA VERSÃO - Não armazena mais coordenadas em pfGeo/pjGeo
 * Apenas garante que os CEPs estejam geocodificados na tabela cep_locations
 */

import prisma from '../lib/db';
import { getCoordinatesForCep } from '../lib/services/postgis';

async function geocodeCollectors() {
  console.log('🌍 Geocodificando CEPs de coletores na tabela cep_locations...\n');

  // Buscar todos os coletores ativos
  const collectors = await prisma.collector.findMany({
    where: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      pfNome: true,
      pjRazaoSocial: true,
      pfCep: true,
      pjCep: true,
    },
  });

  console.log(`📍 Encontrados ${collectors.length} coletores ativos\n`);

  let geocodedPF = 0;
  let geocodedPJ = 0;
  let errors = 0;

  for (const collector of collectors) {
    const nome = collector.pfNome || collector.pjRazaoSocial || 'Sem nome';
    console.log(`\n🔍 Processando: ${nome} (${collector.id})`);

    // Geocodificar CEP PF
    if (collector.pfCep) {
      try {
        console.log(`  ├─ Geocodificando CEP PF: ${collector.pfCep}`);
        const coords = await getCoordinatesForCep(collector.pfCep);
        console.log(`  ├─ ✅ PF: ${coords.lat}, ${coords.lng} (precisão: ${coords.precision})`);
        geocodedPF++;
      } catch (error) {
        console.log(`  ├─ ❌ PF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        errors++;
      }
    } else {
      console.log(`  ├─ ⚠️  CEP PF não informado`);
    }

    // Geocodificar CEP PJ
    if (collector.pjCep) {
      try {
        console.log(`  ├─ Geocodificando CEP PJ: ${collector.pjCep}`);
        const coords = await getCoordinatesForCep(collector.pjCep);
        console.log(`  └─ ✅ PJ: ${coords.lat}, ${coords.lng} (precisão: ${coords.precision})`);
        geocodedPJ++;
      } catch (error) {
        console.log(`  └─ ❌ PJ: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        errors++;
      }
    } else {
      console.log(`  └─ ⚠️  CEP PJ não informado`);
    }
  }

  console.log(`\n✨ Geocodificação concluída!`);
  console.log(`   ✅ ${geocodedPF} CEPs PF processados`);
  console.log(`   ✅ ${geocodedPJ} CEPs PJ processados`);
  console.log(`   ❌ ${errors} erros de geocodificação`);
  console.log(`\n📝 Coordenadas armazenadas em cep_locations (cache PostGIS)`);

  await prisma.$disconnect();
}

// Executar
geocodeCollectors()
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

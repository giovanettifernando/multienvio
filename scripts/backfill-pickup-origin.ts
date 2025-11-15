/**
 * Script de backfill para corrigir dados de origem em PickupRequests
 *
 * Problema: PickupRequests foram criados com dados de DESTINO em vez de ORIGEM
 * Solução: Buscar cada pickup, pegar o shipment associado, e preencher originCity/originUf
 *          baseado no originCep do shipment
 */

import { prisma } from '../lib/db';

async function getCityUfFromCep(cep: string): Promise<{ cidade: string; uf: string } | null> {
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep.replace(/\D/g, '')}`);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      cidade: data.city,
      uf: data.state,
    };
  } catch (error) {
    console.error(`Erro ao buscar CEP ${cep}:`, error);
    return null;
  }
}

async function backfillPickupOrigins() {
  console.log('🔍 Buscando PickupRequests para corrigir...\n');

  // Buscar TODOS os pickups e verificar quais precisam ser corrigidos
  const allPickups = await prisma.pickupRequest.findMany({
    include: {
      shipment: {
        select: {
          id: true,
          originCep: true,
          destinationCity: true,
          destinationState: true,
          platformTrackingCode: true,
        },
      },
    },
  });

  // Filtrar pickups que precisam ser atualizados:
  // 1. Sem cidade/UF (null)
  // 2. Com dados de destino em vez de origem
  const pickups = allPickups.filter(pickup => {
    const hasNullData = !pickup.originCity || !pickup.originUf;
    const hasDestData =
      pickup.originCity === pickup.shipment.destinationCity &&
      pickup.originUf === pickup.shipment.destinationState;

    return hasNullData || hasDestData;
  });

  console.log(`📦 Total de pickups: ${allPickups.length}`);
  console.log(`📦 Pickups para atualizar: ${pickups.length}\n`);

  let updated = 0;
  let failed = 0;

  for (const pickup of pickups) {
    const cep = pickup.originCep;
    const hasNullData = !pickup.originCity || !pickup.originUf;
    const hasDestData =
      pickup.originCity === pickup.shipment.destinationCity &&
      pickup.originUf === pickup.shipment.destinationState;

    const issue = hasNullData ? 'Sem cidade/UF' : 'Dados de destino';
    const currentData = pickup.originCity && pickup.originUf
      ? `${pickup.originCity}/${pickup.originUf}`
      : 'NULL';

    console.log(`\nProcessing pickup ${pickup.id}`);
    console.log(`  CEP: ${cep}`);
    console.log(`  Atual: ${currentData} (${issue})`);

    // Buscar cidade/UF via API
    const location = await getCityUfFromCep(cep);

    if (!location) {
      console.error(`  ❌ Falha ao buscar dados do CEP ${cep}`);
      failed++;
      continue;
    }

    try {
      await prisma.pickupRequest.update({
        where: { id: pickup.id },
        data: {
          originCity: location.cidade,
          originUf: location.uf,
        },
      });

      console.log(`  ✅ Atualizado: ${location.cidade}/${location.uf}`);
      updated++;
    } catch (error) {
      console.error(`  ❌ Erro ao atualizar pickup ${pickup.id}:`, error);
      failed++;
    }

    // Rate limiting: aguardar 300ms entre requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n📊 Resumo:');
  console.log(`  ✅ Atualizados: ${updated}`);
  console.log(`  ❌ Falhas: ${failed}`);
  console.log(`  📦 Total: ${pickups.length}`);
}

// Executar
backfillPickupOrigins()
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

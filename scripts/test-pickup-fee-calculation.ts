/**
 * Script para testar cálculo de taxa de coleta
 *
 * VERSÃO ATUALIZADA - Usa PostGIS e CEPs (não usa mais pfGeo/pjGeo)
 * Coordenadas vêm de cep_locations via getCoordinatesForCep()
 */

import prisma from '../lib/db';
import { getCoordinatesForCep } from '../lib/services/postgis';
import { calculatePickupFee } from '../lib/services/pickupFee';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

async function testPickupFeeCalculation() {
  console.log('\n=== Teste de Cálculo de Taxa de Coleta ===\n');

  try {
    // CEP de teste: João Pessoa/PB
    const testOriginCep = '58035-100';

    console.log('📍 Origem de teste:');
    console.log(`   CEP: ${testOriginCep}`);

    try {
      const originCoords = await getCoordinatesForCep(testOriginCep);
      console.log(`   Coordenadas: ${originCoords.lat}, ${originCoords.lng}`);
      console.log(`   Precisão: ${originCoords.precision}`);
    } catch (error) {
      console.log(`   ⚠️  Não foi possível geocodificar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
    console.log('');

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
        pfCidade: true,
        pfUf: true,
        pjCep: true,
        pjCidade: true,
        pjUf: true,
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

    // Exibir informações de cada coletor e suas coordenadas via CEP
    for (const collector of collectors) {
      const nome = collector.pfNome || 'Sem nome';
      const razaoSocial = collector.pjRazaoSocial || 'Sem razão social';

      console.log(`🚗 ${nome} (${razaoSocial})`);
      console.log(`   Localização: ${collector.pfCidade || collector.pjCidade}/${collector.pfUf || collector.pjUf}`);
      console.log(`   💰 Tipo de taxa: ${collector.pickupFeeType}`);

      if (collector.pickupFeeType === 'FIXED') {
        console.log(`   💵 Taxa fixa: ${currency.format(collector.pickupFixedFee ?? 0)}`);
      } else {
        console.log(`   💵 Taxa por km: ${currency.format(collector.pickupFeePerKm ?? 0)}/km`);
      }

      // Tentar obter coordenadas via CEP (PF primeiro, depois PJ)
      const cep = collector.pfCep || collector.pjCep;
      if (cep) {
        try {
          const coords = await getCoordinatesForCep(cep);
          console.log(`   📍 CEP: ${cep} → ${coords.lat}, ${coords.lng} (${coords.precision})`);
        } catch (error) {
          console.log(`   ⚠️  CEP ${cep}: Não foi possível geocodificar`);
        }
      } else {
        console.log(`   ⚠️  Sem CEP cadastrado (PF ou PJ)`);
      }

      console.log('');
    }

    console.log('\n=== TESTE DE CÁLCULO USANDO calculatePickupFee() ===\n');

    // Simular frete de R$ 50,00
    const freightCost = 50.0;

    const result = await calculatePickupFee(testOriginCep, freightCost);

    if (!result.success) {
      console.log(`❌ Erro ao calcular taxa de coleta: ${result.error}\n`);
      return;
    }

    console.log('=== RESULTADO ===');
    console.log(`🏆 Coletor mais próximo: ${result.collector.nome}`);
    console.log(`📏 Distância: ${result.distanceKm.toFixed(1)} km`);
    console.log(`💰 Tipo de taxa: ${result.feeType}`);
    console.log(`💵 Taxa de coleta: ${currency.format(result.feeAmount)}`);

    if (result.precision) {
      console.log(`\n📍 Precisão do geocoding:`);
      console.log(`   Nível: ${result.precision}`);
      if (result.precisionWarning) {
        console.log(`   ⚠️  ${result.precisionWarning}`);
      } else {
        console.log(`   ✅ Boa precisão (address, zipcode ou city)`);
      }
    }

    console.log('\n=== SIMULAÇÃO DE COTAÇÃO ===');
    console.log(`Frete: ${currency.format(freightCost)}`);
    console.log(`Taxa de coleta: ${currency.format(result.feeAmount)}`);
    console.log(`Total: ${currency.format(result.totalWithPickup)}`);
    console.log('');
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPickupFeeCalculation();

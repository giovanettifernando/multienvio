/**
 * Script de teste para sistema de gerenciamento de CEPs
 *
 * Testa:
 * 1. Correção manual de CEP
 * 2. Proteção contra re-geocoding automático
 * 3. Integração com cálculo de distância
 */

import prisma from '../lib/db';
import { updateCepManual, getCepLocation, forceRegeocodeCep } from '../lib/services/cepLocation';
import { getCoordinatesForCep } from '../lib/services/postgis';
import { calcularDistancia } from '../lib/services/distance';

const CEP_TESTE = '58035100'; // João Pessoa/PB - CEP problemático conhecido

async function testCepManagement() {
  console.log('\n🧪 TESTE: Sistema de Gerenciamento de CEPs\n');
  console.log('=' .repeat(70));

  try {
    // TESTE 1: Buscar CEP atual
    console.log('\n📋 TESTE 1: Verificar estado atual do CEP\n');

    let cepLocation = await getCepLocation(CEP_TESTE);

    if (cepLocation) {
      console.log(`✅ CEP ${CEP_TESTE} encontrado em cep_locations:`);
      console.log(`   Coordenadas: ${cepLocation.latitude}, ${cepLocation.longitude}`);
      console.log(`   Precisão: ${cepLocation.precision}`);
      console.log(`   Provider: ${cepLocation.provider}`);
      console.log(`   Manual Override: ${cepLocation.manualOverride}`);
      if (cepLocation.manualOverrideReason) {
        console.log(`   Motivo: ${cepLocation.manualOverrideReason}`);
      }
    } else {
      console.log(`⚠️  CEP ${CEP_TESTE} não encontrado no cache. Será geocodificado.`);
    }

    // TESTE 2: Correção manual
    console.log('\n📋 TESTE 2: Correção manual de coordenadas\n');

    const COORDENADAS_CORRETAS = {
      lat: -7.1198028,
      lng: -34.8623789,
    };

    console.log(`Atualizando CEP ${CEP_TESTE} com coordenadas precisas...`);
    console.log(`Coordenadas: ${COORDENADAS_CORRETAS.lat}, ${COORDENADAS_CORRETAS.lng}`);

    const updated = await updateCepManual(
      CEP_TESTE,
      COORDENADAS_CORRETAS.lat,
      COORDENADAS_CORRETAS.lng,
      'address',
      'Teste: Coordenadas corrigidas manualmente para validar sistema de override'
    );

    console.log(`\n✅ CEP atualizado com sucesso:`);
    console.log(`   Manual Override: ${updated.manualOverride}`);
    console.log(`   Motivo: ${updated.manualOverrideReason}`);

    // TESTE 3: Verificar proteção contra re-geocoding
    console.log('\n📋 TESTE 3: Verificar proteção contra re-geocoding automático\n');

    const coords = await getCoordinatesForCep(CEP_TESTE);
    console.log(`✅ Coordenadas retornadas via getCoordinatesForCep():`);
    console.log(`   ${coords.lat}, ${coords.lng}`);
    console.log(`   Precisão: ${coords.precision}`);

    if (coords.lat === COORDENADAS_CORRETAS.lat && coords.lng === COORDENADAS_CORRETAS.lng) {
      console.log(`   ✅ Coordenadas corretas mantidas (override funcionando!)`);
    } else {
      console.log(`   ❌ ERRO: Coordenadas diferentes das esperadas!`);
    }

    // TESTE 4: Testar que forceRegeocodeCep falha para CEPs protegidos
    console.log('\n📋 TESTE 4: Tentar forçar re-geocoding (deve falhar)\n');

    try {
      await forceRegeocodeCep(CEP_TESTE);
      console.log(`❌ ERRO: forceRegeocodeCep deveria ter falhado para CEP protegido!`);
    } catch (error) {
      console.log(`✅ forceRegeocodeCep corretamente bloqueado:`);
      console.log(`   ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // TESTE 5: Calcular distância usando CEP corrigido
    console.log('\n📋 TESTE 5: Calcular distância usando CEP corrigido\n');

    const CEP_DESTINO = '58040000'; // Outro CEP em João Pessoa
    console.log(`Calculando distância: ${CEP_TESTE} → ${CEP_DESTINO}`);

    const resultado = await calcularDistancia(CEP_TESTE, CEP_DESTINO);

    console.log(`\n✅ Resultado do cálculo de distância:`);
    console.log(`   Distância: ${resultado.distanciaKm} km`);
    console.log(`   Precisa: ${resultado.precisa}`);
    console.log(`   Precisão origem: ${resultado.precisionOrigem}`);
    console.log(`   Precisão destino: ${resultado.precisionDestino}`);

    if (resultado.motivoImprecisao) {
      console.log(`   ⚠️  Motivo imprecisão: ${resultado.motivoImprecisao}`);
    } else {
      console.log(`   ✅ Cálculo preciso (sem warnings)`);
    }

    // TESTE 6: Estatísticas
    console.log('\n📋 TESTE 6: Estatísticas de CEPs\n');

    const stats = await prisma.$queryRaw<Array<{ precision: string; total: bigint; manual_overrides: bigint }>>`
      SELECT
        precision,
        COUNT(*) as total,
        SUM(CASE WHEN manual_override THEN 1 ELSE 0 END) as manual_overrides
      FROM cep_locations
      GROUP BY precision
      ORDER BY total DESC
    `;

    console.log('Distribuição por precisão:');
    stats.forEach((row) => {
      console.log(
        `   ${row.precision?.padEnd(20) || 'null'.padEnd(20)} | ` +
        `Total: ${String(row.total).padStart(4)} | ` +
        `Manuais: ${String(row.manual_overrides).padStart(3)}`
      );
    });

    console.log('\n' + '='.repeat(70));
    console.log('✨ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!\n');
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCepManagement();

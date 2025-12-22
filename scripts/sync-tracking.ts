/**
 * Script para sincronizar rastreamento de um código específico
 * Uso: npx tsx scripts/sync-tracking.ts AN378943235BR
 */

import { syncCorreiosTracking } from '../modules/tracking/application/sync-correios-tracking.service';

async function main() {
  const trackingCode = process.argv[2] || 'AN378943235BR';

  console.log(`\n🔄 Sincronizando rastreamento: ${trackingCode}\n`);

  const result = await syncCorreiosTracking(trackingCode);

  if (result.success) {
    console.log('✅ Sincronização concluída!');
    console.log(`   Shipment ID: ${result.shipmentId}`);
    console.log(`   Eventos adicionados: ${result.eventsAdded}`);
    console.log(`   Status atualizado: ${result.statusUpdated ? 'Sim' : 'Não'}`);

    if (result.statusUpdated) {
      console.log(`   Status anterior: ${result.previousStatus}`);
      console.log(`   Novo status: ${result.newStatus}`);
    }

    if (result.events && result.events.length > 0) {
      console.log(`\n📋 Eventos (${result.events.length} total):`);
      result.events.forEach((e, i) => {
        const isNewMarker = e.isNew ? ' [NOVO]' : '';
        console.log(`   ${i + 1}. ${e.descricao}${isNewMarker}`);
        console.log(`      ${e.dataHora.toLocaleString('pt-BR')} - ${e.cidade || ''}/${e.uf || ''}`);
      });
    }
  } else {
    console.log('❌ Falha na sincronização');
    console.log(`   Mensagem: ${result.message}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});

/**
 * Script de backfill para preencher recipientName em Labels existentes
 *
 * Problema: Labels foram criados sem o campo recipientName (denormalizado)
 * Solução: Buscar cada label e preencher recipientName a partir do shipment.recipientName
 */

import { prisma } from '../lib/db';

async function backfillLabelRecipientNames() {
  console.log('🔍 Buscando Labels sem recipientName...\n');

  // Buscar todos os labels que não têm recipientName
  const labels = await prisma.label.findMany({
    where: {
      recipientName: null,
    },
    include: {
      shipment: {
        select: {
          id: true,
          recipientName: true,
          trackingCode: true,
          status: true,
        },
      },
    },
  });

  console.log(`📦 Encontrados ${labels.length} labels para atualizar\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const label of labels) {
    console.log(`\nProcessing label ${label.id}`);
    console.log(`  Shipment: ${label.shipment.trackingCode}`);
    console.log(`  Status: ${label.shipment.status}`);

    // Verificar se o shipment tem recipientName
    if (!label.shipment.recipientName) {
      console.log(`  ⚠️  Shipment sem recipientName - pulando`);
      skipped++;
      continue;
    }

    try {
      await prisma.label.update({
        where: { id: label.id },
        data: {
          recipientName: label.shipment.recipientName,
        },
      });

      console.log(`  ✅ Atualizado: ${label.shipment.recipientName}`);
      updated++;
    } catch (error) {
      console.error(`  ❌ Erro ao atualizar label ${label.id}:`, error);
      failed++;
    }
  }

  console.log('\n📊 Resumo:');
  console.log(`  ✅ Atualizados: ${updated}`);
  console.log(`  ⚠️  Pulados (sem recipientName no shipment): ${skipped}`);
  console.log(`  ❌ Falhas: ${failed}`);
  console.log(`  📦 Total: ${labels.length}`);
}

// Executar
backfillLabelRecipientNames()
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

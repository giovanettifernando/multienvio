/**
 * Script de correção para Shipments existentes sem volumes
 * Cria 1 volume padrão usando os dados declarados do Shipment
 *
 * Execução: DATABASE_URL="..." npx tsx scripts/fix-shipments-without-volumes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[FIX] Iniciando correção de Shipments sem volumes...\n');

  // Buscar todos os shipments sem volumes (exceto cancelados)
  const shipmentsWithoutVolumes = await prisma.shipment.findMany({
    where: {
      status: {
        not: 'cancelled',
      },
      packages: {
        none: {},
      },
    },
    select: {
      id: true,
      platformTrackingCode: true,
      status: true,
      weight: true,
      document: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`📊 Total de Shipments a corrigir: ${shipmentsWithoutVolumes.length}\n`);

  if (shipmentsWithoutVolumes.length === 0) {
    console.log('✅ Nenhum shipment sem volumes encontrado!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  // Processar cada shipment
  for (const shipment of shipmentsWithoutVolumes) {
    try {
      console.log(`\n🔧 Processando Shipment ${shipment.platformTrackingCode}...`);
      console.log(`   ID: ${shipment.id}`);
      console.log(`   Status: ${shipment.status}`);
      console.log(`   Peso declarado: ${shipment.weight} kg`);

      // Tentar extrair dimensões do documento (se existir)
      let width = 30; // Padrão: 30cm
      let height = 20; // Padrão: 20cm
      let length = 40; // Padrão: 40cm
      let weight = shipment.weight || 1; // Usar peso declarado ou 1kg padrão

      const document = shipment.document as any;
      if (document?.volumes && Array.isArray(document.volumes) && document.volumes.length > 0) {
        const firstVolume = document.volumes[0];
        if (firstVolume.largura) width = firstVolume.largura;
        if (firstVolume.altura) height = firstVolume.altura;
        if (firstVolume.comprimento) length = firstVolume.comprimento;
        if (firstVolume.peso) weight = firstVolume.peso;

        console.log(`   ℹ️  Dimensões extraídas do documento`);
      } else {
        console.log(`   ⚠️  Documento sem volumes, usando dimensões padrão`);
      }

      // Criar volume de correção
      const createdPackage = await prisma.package.create({
        data: {
          shipmentId: shipment.id,
          packageNumber: 1,
          width,
          height,
          length,
          weight,
          hasDivergence: false,
        },
      });

      console.log(`   ✅ Volume criado com sucesso!`);
      console.log(`      Dimensões: ${width} × ${height} × ${length} cm`);
      console.log(`      Peso: ${weight} kg`);

      successCount++;
    } catch (error) {
      console.error(`   ❌ Erro ao processar shipment ${shipment.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n\n📈 Resumo da correção:`);
  console.log(`   ✅ Shipments corrigidos: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);
  console.log(`   📦 Total processado: ${shipmentsWithoutVolumes.length}`);

  if (successCount === shipmentsWithoutVolumes.length) {
    console.log(`\n🎉 Correção concluída com sucesso!`);
  } else if (errorCount > 0) {
    console.log(`\n⚠️  Correção concluída com ${errorCount} erro(s)`);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

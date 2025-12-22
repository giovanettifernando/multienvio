#!/usr/bin/env node
/**
 * Script para exportar um shipment do banco de homologação
 * Execute no servidor de homologação:
 *   node scripts/export-shipment.mjs AN378943235BR
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const trackingCode = process.argv[2];

  if (!trackingCode) {
    console.error('Uso: node scripts/export-shipment.mjs <CODIGO_RASTREIO>');
    process.exit(1);
  }

  console.log(`Buscando shipment com código: ${trackingCode}`);

  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [
        { carrierTrackingCode: trackingCode },
        { platformTrackingCode: trackingCode },
      ],
    },
    include: {
      trackingEvents: true,
      packages: true,
      label: true,
    },
  });

  if (!shipment) {
    console.error('Shipment não encontrado!');
    process.exit(1);
  }

  // Exportar como JSON
  const exportData = {
    shipment: {
      ...shipment,
      // Remover relacionamentos circulares
      trackingEvents: undefined,
      packages: undefined,
      label: undefined,
    },
    trackingEvents: shipment.trackingEvents,
    packages: shipment.packages,
    label: shipment.label,
  };

  console.log('\n=== DADOS PARA IMPORTAÇÃO ===\n');
  console.log(JSON.stringify(exportData, null, 2));
  console.log('\n=== FIM DOS DADOS ===\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

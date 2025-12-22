#!/usr/bin/env node
/**
 * Script para importar um shipment exportado de outro ambiente
 *
 * Uso:
 *   1. Cole o JSON exportado em um arquivo (ex: shipment-data.json)
 *   2. Execute: node scripts/import-shipment.mjs shipment-data.json
 *
 *   Ou passe o JSON diretamente via stdin:
 *   echo '{"shipment": {...}}' | node scripts/import-shipment.mjs
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
  let jsonData;

  // Ler de arquivo ou stdin
  const filePath = process.argv[2];

  if (filePath) {
    const content = readFileSync(filePath, 'utf-8');
    jsonData = JSON.parse(content);
  } else {
    // Ler de stdin
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    jsonData = JSON.parse(content);
  }

  const { shipment, trackingEvents, packages, label } = jsonData;

  if (!shipment) {
    console.error('JSON inválido: falta o campo "shipment"');
    process.exit(1);
  }

  console.log(`Importando shipment: ${shipment.carrierTrackingCode || shipment.platformTrackingCode}`);

  // Verificar se já existe
  const existing = await prisma.shipment.findFirst({
    where: {
      OR: [
        { id: shipment.id },
        { carrierTrackingCode: shipment.carrierTrackingCode },
        { platformTrackingCode: shipment.platformTrackingCode },
      ].filter(Boolean),
    },
  });

  if (existing) {
    console.log('Shipment já existe! Atualizando...');

    // Atualizar shipment existente
    await prisma.shipment.update({
      where: { id: existing.id },
      data: {
        status: shipment.status,
        carrierTrackingCode: shipment.carrierTrackingCode,
        postedAt: shipment.postedAt ? new Date(shipment.postedAt) : null,
        deliveredAt: shipment.deliveredAt ? new Date(shipment.deliveredAt) : null,
      },
    });

    // Adicionar eventos que não existem
    if (trackingEvents?.length > 0) {
      for (const event of trackingEvents) {
        const existingEvent = await prisma.trackingEvent.findFirst({
          where: {
            shipmentId: existing.id,
            occurredAt: new Date(event.occurredAt),
            type: event.type,
          },
        });

        if (!existingEvent) {
          await prisma.trackingEvent.create({
            data: {
              shipmentId: existing.id,
              type: event.type,
              description: event.description,
              city: event.city,
              uf: event.uf,
              occurredAt: new Date(event.occurredAt),
            },
          });
          console.log(`  + Evento adicionado: ${event.type} - ${event.description}`);
        }
      }
    }

    console.log('Atualização concluída!');
    return;
  }

  // Criar novo shipment
  console.log('Criando novo shipment...');

  // Verificar se o sender existe (precisa existir)
  if (shipment.senderId) {
    const sender = await prisma.sender.findUnique({
      where: { id: shipment.senderId },
    });

    if (!sender) {
      console.log('Sender não existe, criando sender placeholder...');
      // Criar sender placeholder
      await prisma.sender.create({
        data: {
          id: shipment.senderId,
          userId: shipment.senderId, // Usar mesmo ID como placeholder
          name: 'Remetente Importado',
          document: '00000000000',
          email: 'importado@placeholder.com',
          phone: '00000000000',
          cep: shipment.originCep || '00000000',
          street: 'Endereço Placeholder',
          city: 'Cidade',
          state: 'PB',
        },
      });
    }
  }

  // Criar shipment
  const newShipment = await prisma.shipment.create({
    data: {
      id: shipment.id,
      platformTrackingCode: shipment.platformTrackingCode,
      publicTrackingId: shipment.publicTrackingId,
      carrierTrackingCode: shipment.carrierTrackingCode,
      status: shipment.status,
      carrier: shipment.carrier,
      service: shipment.service,
      originCep: shipment.originCep,
      destinationCep: shipment.destinationCep,
      destinationCity: shipment.destinationCity,
      destinationState: shipment.destinationState,
      recipientName: shipment.recipientName,
      recipientDocument: shipment.recipientDocument,
      recipientEmail: shipment.recipientEmail,
      recipientPhone: shipment.recipientPhone,
      recipientStreet: shipment.recipientStreet,
      recipientNumber: shipment.recipientNumber,
      recipientComplement: shipment.recipientComplement,
      recipientNeighborhood: shipment.recipientNeighborhood,
      estimatedDays: shipment.estimatedDays,
      freightCost: shipment.freightCost,
      declaredValue: shipment.declaredValue,
      weight: shipment.weight,
      document: shipment.document,
      postedAt: shipment.postedAt ? new Date(shipment.postedAt) : null,
      deliveredAt: shipment.deliveredAt ? new Date(shipment.deliveredAt) : null,
      senderId: shipment.senderId,
    },
  });

  console.log(`Shipment criado: ${newShipment.id}`);

  // Criar eventos
  if (trackingEvents?.length > 0) {
    for (const event of trackingEvents) {
      await prisma.trackingEvent.create({
        data: {
          shipmentId: newShipment.id,
          type: event.type,
          description: event.description,
          city: event.city,
          uf: event.uf,
          occurredAt: new Date(event.occurredAt),
        },
      });
      console.log(`  + Evento: ${event.type}`);
    }
  }

  // Criar packages
  if (packages?.length > 0) {
    for (const pkg of packages) {
      await prisma.package.create({
        data: {
          shipmentId: newShipment.id,
          packageNumber: pkg.packageNumber,
          height: pkg.height,
          width: pkg.width,
          length: pkg.length,
          weight: pkg.weight,
        },
      });
      console.log(`  + Package: ${pkg.packageNumber}`);
    }
  }

  // Criar label
  if (label) {
    await prisma.label.create({
      data: {
        shipmentId: newShipment.id,
        trackingCode: label.trackingCode,
        status: label.status,
        fileBase64: label.fileBase64,
        zplContent: label.zplContent,
        generatedAt: label.generatedAt ? new Date(label.generatedAt) : null,
      },
    });
    console.log('  + Label criada');
  }

  console.log('\nImportação concluída com sucesso!');
  console.log(`Código de rastreio: ${newShipment.carrierTrackingCode}`);
  console.log(`Link público: ${newShipment.publicTrackingId}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

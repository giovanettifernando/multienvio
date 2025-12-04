import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Buscar shipments recentes com seus documents
  const shipments = await prisma.shipment.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      document: true,
      cartItemId: true,
      packages: {
        select: {
          id: true,
          packageNumber: true,
        }
      }
    }
  });

  console.log('=== SHIPMENTS RECENTES ===\n');
  for (const s of shipments) {
    console.log('--- Shipment:', s.id, '---');
    console.log('CartItemId:', s.cartItemId || 'NULL (checkout direto)');
    console.log('CreatedAt:', s.createdAt);
    console.log('Packages:', s.packages?.length || 0);

    const doc = s.document;
    if (doc) {
      console.log('Document keys:', Object.keys(doc));
      console.log('Document.type:', doc.type || 'undefined');

      // Verificar se tem dados de declaração/NF-e
      if (doc.volumeDeclarations) {
        console.log('volumeDeclarations:', JSON.stringify(doc.volumeDeclarations, null, 2));
      }
      if (doc.declarationItems) {
        console.log('declarationItems:', JSON.stringify(doc.declarationItems, null, 2));
      }
      if (doc.packages) {
        console.log('packages (NFE):', JSON.stringify(doc.packages, null, 2));
      }
      if (doc.nfeItems) {
        console.log('nfeItems:', JSON.stringify(doc.nfeItems, null, 2));
      }
      if (doc.volumes) {
        console.log('volumes (dimensões):', JSON.stringify(doc.volumes, null, 2));
      }
    } else {
      console.log('Document: NULL');
    }
    console.log('\n');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

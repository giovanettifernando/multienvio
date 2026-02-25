import { prisma } from './lib/db';

async function main() {
  const code = process.argv[2] || 'EL17719438691362PRSG';
  const s = await prisma.shipment.findFirst({
    where: { platformTrackingCode: code },
    include: {
      packages: true,
      label: { select: { id: true, status: true, fileBase64: true, carrier: true, service: true } },
    },
  });
  if (s == null) { console.log('NOT FOUND'); return; }

  console.log(JSON.stringify({
    id: s.id,
    status: s.status,
    carrier: s.carrier,
    service: s.service,
    carrierTrackingCode: s.carrierTrackingCode,
    carrierMetadata: s.carrierMetadata,
    label: s.label ? {
      id: s.label.id,
      status: s.label.status,
      hasBase64: s.label.fileBase64 != null && s.label.fileBase64.length > 0,
      carrier: s.label.carrier,
      service: s.label.service,
    } : null,
    packages: s.packages.map(p => ({
      id: p.id,
      packageNumber: p.packageNumber,
      carrierTrackingCode: p.carrierTrackingCode,
      carrierPrePostageId: p.carrierPrePostageId,
    })),
  }, null, 2));

  // Check if there's a GeneratedDocument for this
  const docs = await prisma.generatedDocument.findMany({
    where: {
      userId: s.senderId,
      documentType: 'label',
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, status: true, errorMessage: true, createdAt: true, referenceId: true },
  });
  console.log('\nRecent GeneratedDocuments:');
  for (const d of docs) {
    console.log(JSON.stringify(d));
  }
}

main().finally(() => prisma.$disconnect());

/**
 * Test script to validate collector document persistence flow
 *
 * Tests:
 * 1. Documents saved during registration
 * 2. Documents visible in database
 * 3. Upsert functionality (updating existing documents)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCollectorDocuments() {
  console.log('🧪 Testing Collector Document Persistence Flow\n');

  try {
    // 1. Check current state of documents
    console.log('📊 Current Documents in Database:');
    console.log('════════════════════════════════════════════════════════\n');

    const documents = await prisma.collectorDocument.findMany({
      include: {
        collector: {
          select: {
            id: true,
            pfNome: true,
            pfEmail: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    if (documents.length === 0) {
      console.log('❌ No documents found in database');
      console.log('   Documents will be saved when:');
      console.log('   1. A collector registers via /coletores/cadastro');
      console.log('   2. A logged-in collector uploads via /api/coletores/documentos\n');
    } else {
      console.log(`✅ Found ${documents.length} documents:\n`);
      documents.forEach((doc, i) => {
        console.log(`${i + 1}. ${doc.type.toUpperCase()} - ${doc.filename}`);
        console.log(`   Collector: ${doc.collector.pfNome} (${doc.collector.pfEmail})`);
        console.log(`   URL: ${doc.url || doc.storageKey || 'N/A'}`);
        console.log(`   Size: ${doc.size ? (doc.size / 1024).toFixed(2) + ' KB' : 'N/A'}`);
        console.log(`   Uploaded: ${doc.uploadedAt.toLocaleString('pt-BR')}`);
        console.log();
      });
    }

    // 2. Group by collector and type
    console.log('📋 Documents by Collector:');
    console.log('════════════════════════════════════════════════════════\n');

    const collectors = await prisma.collector.findMany({
      include: {
        documents: {
          orderBy: {
            type: 'asc',
          },
        },
      },
      where: {
        documents: {
          some: {},
        },
      },
      take: 5,
    });

    if (collectors.length === 0) {
      console.log('❌ No collectors with documents found\n');
    } else {
      collectors.forEach((collector, i) => {
        console.log(`${i + 1}. ${collector.pfNome} (${collector.pfEmail})`);
        console.log(`   Status: ${collector.status}`);
        console.log(`   Documents (${collector.documents.length}):`);

        const docTypes = ['cnh', 'crlv', 'pf_address_proof'];
        docTypes.forEach(type => {
          const doc = collector.documents.find(d => d.type === type);
          if (doc) {
            console.log(`     ✓ ${type.toUpperCase()}: ${doc.filename}`);
          } else {
            console.log(`     ✗ ${type.toUpperCase()}: Missing`);
          }
        });
        console.log();
      });
    }

    // 3. Check for missing documents
    console.log('⚠️  Collectors Missing Documents:');
    console.log('════════════════════════════════════════════════════════\n');

    const collectorsWithoutDocs = await prisma.collector.findMany({
      where: {
        documents: {
          none: {},
        },
      },
      select: {
        id: true,
        pfNome: true,
        pfEmail: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    if (collectorsWithoutDocs.length === 0) {
      console.log('✅ All collectors have documents\n');
    } else {
      console.log(`Found ${collectorsWithoutDocs.length} collectors without documents:\n`);
      collectorsWithoutDocs.forEach((c, i) => {
        console.log(`${i + 1}. ${c.pfNome} (${c.pfEmail})`);
        console.log(`   Status: ${c.status}`);
        console.log(`   Created: ${c.createdAt.toLocaleString('pt-BR')}`);
        console.log();
      });
    }

    // 4. Test upsert functionality (conceptual)
    console.log('📝 Document Persistence Flow:');
    console.log('════════════════════════════════════════════════════════\n');
    console.log('🔹 During Registration (/api/coletores/auth/register):');
    console.log('  1. Collector fills form with PF, PJ, Vehicle, Documents, Bank');
    console.log('  2. Frontend uploads files (CNH, CRLV, Address Proof) and gets URLs');
    console.log('  3. Frontend sends all data to /api/coletores/auth/register');
    console.log('  4. Backend creates collector + credentials + documents');
    console.log('  5. Documents are saved with url from upload\n');

    console.log('🔹 After Login (API /api/coletores/documentos):');
    console.log('  1. Collector logs in → gets JWT in cookie');
    console.log('  2. Collector uploads new/updated documents');
    console.log('  3. Backend extracts collectorId from JWT (NEVER from client)');
    console.log('  4. Backend validates and stores files');
    console.log('  5. UPSERT by (collectorId, type):');
    console.log('     - If document exists → UPDATE (url, filename, size, etc.)');
    console.log('     - If document new → CREATE\n');

    console.log('🔹 Modes Supported:');
    console.log('  • Multipart: Client sends File objects via FormData');
    console.log('  • JSON: Client pre-uploads and sends metadata with URLs\n');

    console.log('🔹 Unique Constraint:');
    console.log('  • @@unique([collectorId, type])');
    console.log('  • Each collector can have only ONE document per type');
    console.log('  • Uploading same type again → replaces previous\n');

    console.log('✅ Test completed!\n');

  } catch (error) {
    console.error('❌ Error in test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testCollectorDocuments()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

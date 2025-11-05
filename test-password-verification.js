/**
 * Script to test password verification for a specific collector
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testPasswordVerification() {
  console.log('🔐 Testing Password Verification\n');

  try {
    const email = 'jlgiovanetti@gmail.com';

    const collector = await prisma.collector.findFirst({
      where: {
        pfEmail: {
          equals: email,
          mode: 'insensitive',
        },
      },
      include: {
        credential: true,
      },
    });

    if (!collector) {
      console.log('❌ Collector not found');
      return;
    }

    console.log('✅ Collector Found:');
    console.log(`   Name: ${collector.pfNome}`);
    console.log(`   Email: ${collector.pfEmail}`);
    console.log(`   Status: ${collector.status}`);
    console.log(`   Email Verified: ${collector.pfEmailVerified}`);
    console.log(`   Has Credential: ${!!collector.credential}`);

    if (collector.credential) {
      console.log(`   Password Hash: ${collector.credential.passwordHash.substring(0, 20)}...`);
      console.log(`   Hash Length: ${collector.credential.passwordHash.length}`);
      console.log(`   Hash starts with $2: ${collector.credential.passwordHash.startsWith('$2')}`);

      // Test with some common passwords to help debug
      console.log('\n🧪 Testing password verification:');
      console.log('   (Try these passwords in the login form)\n');

      // Show hash details
      const hashParts = collector.credential.passwordHash.split('$');
      if (hashParts.length >= 4) {
        console.log(`   Bcrypt version: $${hashParts[1]}$`);
        console.log(`   Cost factor: ${hashParts[2]}`);
      }
    } else {
      console.log('   ❌ No credential found for this collector!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testPasswordVerification()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

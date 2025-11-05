/**
 * Direct test of login API endpoint
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testLoginDirect() {
  console.log('🧪 Testing Login API Logic Directly\n');

  const email = 'jlgiovanetti@gmail.com';
  const password = 'senha123';

  try {
    console.log('1️⃣ Finding collector by email (case-insensitive)...');
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

    console.log('✅ Collector found:', collector.id);
    console.log();

    console.log('2️⃣ Checking credential exists...');
    if (!collector.credential) {
      console.log('❌ No credential found');
      return;
    }
    console.log('✅ Credential exists');
    console.log();

    console.log('3️⃣ Verifying password with bcrypt.compare...');
    console.log(`   Password: "${password}"`);
    console.log(`   Hash: ${collector.credential.passwordHash.substring(0, 20)}...`);

    const passwordMatch = await bcrypt.compare(password, collector.credential.passwordHash);
    console.log(`   Result: ${passwordMatch ? '✅ MATCH' : '❌ NO MATCH'}`);

    if (!passwordMatch) {
      console.log('❌ Password verification failed - would return 401 INVALID_CREDENTIALS');
      return;
    }
    console.log();

    console.log('4️⃣ Checking email verification...');
    console.log(`   pfEmailVerified: ${collector.pfEmailVerified}`);
    if (!collector.pfEmailVerified) {
      console.log('❌ Email not verified - would return 403 EMAIL_NOT_VERIFIED');
      return;
    }
    console.log('✅ Email verified');
    console.log();

    console.log('5️⃣ Checking account status...');
    console.log(`   Status: ${collector.status}`);

    if (collector.status === 'BLOCKED') {
      console.log('❌ Account blocked - would return 403 ACCOUNT_INACTIVE');
      return;
    }

    if (collector.status === 'INACTIVE') {
      console.log('⏳ Account inactive - would return 403 ACCOUNT_INACTIVE');
      return;
    }

    if (collector.status === 'ACTIVE') {
      console.log('✅ Account active - LOGIN ALLOWED');
      console.log();

      console.log('6️⃣ Would return successful response:');
      console.log({
        message: 'Login realizado com sucesso',
        coletor: {
          id: collector.id,
          status: collector.status.toLowerCase(),
          pfNome: collector.pfNome,
          pfEmail: collector.pfEmail,
          pfCelular: collector.pfCelular,
          pjRazaoSocial: collector.pjRazaoSocial,
          pjCnpj: collector.pjCnpj,
        },
      });
      console.log();
      console.log('✅ ALL CHECKS PASSED - Login should work!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testLoginDirect()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

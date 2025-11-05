/**
 * Test script to validate login API endpoint behavior
 *
 * This script demonstrates the different responses from the login API
 * based on various scenarios (valid credentials, wrong password, etc.)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testLoginAPI() {
  console.log('🧪 Testing Login API Scenarios\n');

  try {
    // Get an active collector with verified email
    const activeCollector = await prisma.collector.findFirst({
      where: {
        status: 'ACTIVE',
        pfEmailVerified: true,
      },
      include: {
        credential: true,
      },
    });

    if (!activeCollector) {
      console.log('❌ No active collectors found for testing');
      console.log('   Please create a collector first using /coletores/cadastro');
      return;
    }

    console.log('📋 Test Collector Found:');
    console.log('════════════════════════════════════════════════════════');
    console.log(`Name: ${activeCollector.pfNome}`);
    console.log(`Email: ${activeCollector.pfEmail}`);
    console.log(`Status: ${activeCollector.status}`);
    console.log(`Email Verified: ${activeCollector.pfEmailVerified ? '✓' : '✗'}`);
    console.log(`Has Credentials: ${activeCollector.credential ? '✓' : '✗'}`);
    console.log();

    // Test scenarios
    console.log('📝 Test Scenarios:');
    console.log('════════════════════════════════════════════════════════\n');

    // Scenario 1: Valid credentials (ACTIVE + verified)
    console.log('✅ Scenario 1: Valid Credentials (ACTIVE + Email Verified)');
    console.log('   Request: POST /api/coletores/auth/login');
    console.log(`   Body: { email: "${activeCollector.pfEmail}", password: "correct_password" }`);
    console.log('   Expected Response: 200 OK');
    console.log('   Expected Body:');
    console.log('   {');
    console.log('     "message": "Login realizado com sucesso",');
    console.log('     "coletor": {');
    console.log(`       "id": "${activeCollector.id}",`);
    console.log('       "status": "active",');
    console.log(`       "pfNome": "${activeCollector.pfNome}",`);
    console.log('       ... (other fields)');
    console.log('     }');
    console.log('   }');
    console.log('   Note: JWT cookie "coletor-token" set (httpOnly, 7 days)\n');

    // Scenario 2: Wrong password
    console.log('❌ Scenario 2: Wrong Password');
    console.log('   Request: POST /api/coletores/auth/login');
    console.log(`   Body: { email: "${activeCollector.pfEmail}", password: "wrong_password" }`);
    console.log('   Expected Response: 401 Unauthorized');
    console.log('   Expected Body:');
    console.log('   {');
    console.log('     "code": "INVALID_CREDENTIALS",');
    console.log('     "message": "E-mail ou senha inválidos"');
    console.log('   }');
    console.log(`   Log: [login] INVALID_CREDENTIALS: Wrong password for collector ID: ${activeCollector.id}\n`);

    // Scenario 3: Non-existent email
    console.log('❌ Scenario 3: Non-existent Email');
    console.log('   Request: POST /api/coletores/auth/login');
    console.log('   Body: { email: "nonexistent@example.com", password: "any_password" }');
    console.log('   Expected Response: 401 Unauthorized');
    console.log('   Expected Body:');
    console.log('   {');
    console.log('     "code": "INVALID_CREDENTIALS",');
    console.log('     "message": "E-mail ou senha inválidos"');
    console.log('   }');
    console.log('   Log: [login] INVALID_CREDENTIALS: Collector not found for email: non***');
    console.log('   Note: Same error message as wrong password (security best practice)\n');

    // Check if there are any INACTIVE collectors
    const inactiveCollector = await prisma.collector.findFirst({
      where: {
        status: 'INACTIVE',
        pfEmailVerified: true,
      },
    });

    if (inactiveCollector) {
      console.log('⏳ Scenario 4: Account INACTIVE (Awaiting Admin Approval)');
      console.log('   Request: POST /api/coletores/auth/login');
      console.log(`   Body: { email: "${inactiveCollector.pfEmail}", password: "correct_password" }`);
      console.log('   Expected Response: 403 Forbidden');
      console.log('   Expected Body:');
      console.log('   {');
      console.log('     "code": "ACCOUNT_INACTIVE",');
      console.log('     "message": "Sua conta está aguardando aprovação do administrador."');
      console.log('   }');
      console.log(`   Log: [login] ACCOUNT_INACTIVE: Collector ID: ${inactiveCollector.id}\n`);
    }

    // Check if there are any BLOCKED collectors
    const blockedCollector = await prisma.collector.findFirst({
      where: {
        status: 'BLOCKED',
      },
    });

    if (blockedCollector) {
      console.log('🚫 Scenario 5: Account BLOCKED');
      console.log('   Request: POST /api/coletores/auth/login');
      console.log(`   Body: { email: "${blockedCollector.pfEmail || 'email@example.com'}", password: "correct_password" }`);
      console.log('   Expected Response: 403 Forbidden');
      console.log('   Expected Body:');
      console.log('   {');
      console.log('     "code": "ACCOUNT_INACTIVE",');
      console.log('     "message": "Sua conta está bloqueada. Entre em contato com o suporte."');
      console.log('   }');
      console.log(`   Log: [login] ACCOUNT_BLOCKED: Collector ID: ${blockedCollector.id}\n`);
    }

    // Check if there are collectors with unverified email
    const unverifiedCollector = await prisma.collector.findFirst({
      where: {
        pfEmailVerified: false,
        pfEmail: { not: null },
      },
    });

    if (unverifiedCollector) {
      console.log('📧 Scenario 6: Email Not Verified');
      console.log('   Request: POST /api/coletores/auth/login');
      console.log(`   Body: { email: "${unverifiedCollector.pfEmail}", password: "correct_password" }`);
      console.log('   Expected Response: 403 Forbidden');
      console.log('   Expected Body:');
      console.log('   {');
      console.log('     "code": "EMAIL_NOT_VERIFIED",');
      console.log('     "message": "Confirme seu e-mail para continuar. Verifique sua caixa de entrada.",');
      console.log(`     "collectorId": "${unverifiedCollector.id}"`);
      console.log('   }');
      console.log(`   Log: [login] EMAIL_NOT_VERIFIED: Collector ID: ${unverifiedCollector.id}`);
      console.log('   Frontend Action: Show "Reenviar e-mail de verificação" button\n');
    }

    // Case-insensitive test
    console.log('🔤 Scenario 7: Case-Insensitive Email Search');
    console.log('   Request: POST /api/coletores/auth/login');
    console.log(`   Body: { email: "${activeCollector.pfEmail.toUpperCase()}", password: "correct_password" }`);
    console.log('   Expected Response: 200 OK (same as Scenario 1)');
    console.log('   Note: Email search is case-insensitive\n');

    console.log('\n🔐 Security Features Implemented:');
    console.log('════════════════════════════════════════════════════════');
    console.log('✓ Case-insensitive email search');
    console.log('✓ bcrypt password hashing');
    console.log('✓ httpOnly cookies (prevents XSS)');
    console.log('✓ JWT with 7-day expiration');
    console.log('✓ Obfuscated email logging (abc***)');
    console.log('✓ No information leakage in 401 responses');
    console.log('✓ Comprehensive event logging');

    console.log('\n⚠️  Security Enhancements TODO:');
    console.log('════════════════════════════════════════════════════════');
    console.log('○ Rate limiting on login endpoint');
    console.log('○ Account lockout after N failed attempts');
    console.log('○ CSRF token protection');
    console.log('○ Two-factor authentication (optional)');

    console.log('\n✅ Test scenarios documented!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testLoginAPI()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

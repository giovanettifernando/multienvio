/**
 * Script to reset a collector's password for testing
 *
 * Usage:
 * DATABASE_URL="..." node reset-collector-password.js email@example.com newpassword
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: node reset-collector-password.js <email> <new-password>');
    process.exit(1);
  }

  console.log(`🔐 Resetting password for collector: ${email}\n`);

  try {
    // Find collector
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
      console.error('❌ Collector not found with email:', email);
      process.exit(1);
    }

    console.log('✅ Collector found:');
    console.log(`   ID: ${collector.id}`);
    console.log(`   Name: ${collector.pfNome}`);
    console.log(`   Email: ${collector.pfEmail}`);
    console.log(`   Status: ${collector.status}`);
    console.log(`   Email Verified: ${collector.pfEmailVerified}`);
    console.log();

    // Hash new password
    console.log('🔒 Hashing new password...');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log(`   Hash: ${passwordHash.substring(0, 20)}...`);
    console.log();

    // Update or create credential
    if (collector.credential) {
      console.log('📝 Updating existing credential...');
      await prisma.collectorCredential.update({
        where: { collectorId: collector.id },
        data: { passwordHash },
      });
    } else {
      console.log('📝 Creating new credential...');
      await prisma.collectorCredential.create({
        data: {
          collectorId: collector.id,
          passwordHash,
        },
      });
    }

    console.log('✅ Password updated successfully!\n');
    console.log('📋 Login credentials:');
    console.log(`   Email: ${collector.pfEmail}`);
    console.log(`   Password: ${newPassword}`);
    console.log();
    console.log('🌐 Try logging in at:');
    console.log(`   ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/coletores/login`);
    console.log();

    // Test the password
    console.log('🧪 Verifying password works...');
    const match = await bcrypt.compare(newPassword, passwordHash);
    console.log(`   bcrypt.compare result: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

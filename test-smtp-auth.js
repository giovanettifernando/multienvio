const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '824cee9bccecff10b828ad3ae52340c62162e2c1aefd07861640a62835420ac3';
const ALGORITHM = 'aes-256-gcm';
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

function decrypt(ciphertext) {
  if (!ciphertext) return '';

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const [ivHex, authTagHex, encrypted] = parts;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY_BUFFER,
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function testSmtpAuth() {
  try {
    console.log('🔍 Buscando configuração de email...\n');

    const config = await prisma.emailConfig.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      console.log('❌ Nenhuma configuração encontrada');
      return;
    }

    const password = decrypt(config.password);

    console.log('📧 Configuração SMTP:');
    console.log('   Host:', config.host);
    console.log('   Port:', config.port);
    console.log('   Secure:', config.secure);
    console.log('   User:', config.user);
    console.log('   Password length:', password.length);
    console.log('');

    console.log('🔌 Testando conectividade...');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: password,
      },
      debug: true, // Enable debug output
      logger: true, // Log information
    });

    // Test 1: Verify (connectivity only)
    try {
      await transporter.verify();
      console.log('✅ Conectividade OK\n');
    } catch (error) {
      console.log('❌ Falha na conectividade:', error.message);
      return;
    }

    // Test 2: Send email (tests full authentication)
    console.log('🔐 Testando autenticação completa (enviando email)...');
    try {
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromAddress}>`,
        to: config.user, // Send to self
        subject: 'Teste de Autenticação SMTP',
        text: 'Este é um teste de autenticação.',
        html: '<p>Este é um teste de autenticação.</p>',
      });

      console.log('✅ Autenticação OK!');
      console.log('   Message ID:', info.messageId);
      console.log('   Accepted:', info.accepted);
      console.log('   Response:', info.response);
    } catch (error) {
      console.log('❌ Falha na autenticação:', error.message);
      console.log('   Code:', error.code);
      console.log('   Response:', error.response);
      console.log('   Command:', error.command);

      if (error.code === 'EAUTH') {
        console.log('\n⚠️  Erro de autenticação!');
        console.log('   Possíveis causas:');
        console.log('   1. Senha incorreta');
        console.log('   2. Usuário bloqueado ou desativado');
        console.log('   3. Autenticação de dois fatores ativada');
        console.log('   4. Requer app password ao invés de senha normal');
        console.log('   5. IP bloqueado pelo servidor');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSmtpAuth();

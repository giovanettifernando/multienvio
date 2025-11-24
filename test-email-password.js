const { PrismaClient } = require('@prisma/client');
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

async function checkEmailConfig() {
  try {
    console.log('🔍 Buscando configuração de email ativa...\n');

    const config = await prisma.emailConfig.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      console.log('❌ Nenhuma configuração de email encontrada');
      return;
    }

    console.log('✅ Configuração encontrada:');
    console.log('   ID:', config.id);
    console.log('   Host:', config.host);
    console.log('   Port:', config.port);
    console.log('   Secure:', config.secure);
    console.log('   User:', config.user);
    console.log('   FromAddress:', config.fromAddress);
    console.log('   FromName:', config.fromName);
    console.log('   Status:', config.status);
    console.log('');

    console.log('🔐 Senha criptografada:');
    console.log('   Existe?', !!config.password);
    console.log('   Formato:', config.password ? `${config.password.substring(0, 20)}...` : 'VAZIO');
    console.log('   Tamanho:', config.password ? config.password.length : 0);
    console.log('');

    if (config.password) {
      try {
        const decryptedPassword = decrypt(config.password);
        console.log('✅ Senha descriptografada com sucesso');
        console.log('   Tamanho:', decryptedPassword.length);
        console.log('   Primeiro caractere:', decryptedPassword.charAt(0));
        console.log('   Último caractere:', decryptedPassword.charAt(decryptedPassword.length - 1));
        console.log('   Senha (parcial):', decryptedPassword.substring(0, 3) + '***' + decryptedPassword.substring(decryptedPassword.length - 3));
      } catch (error) {
        console.log('❌ Erro ao descriptografar senha:', error.message);
      }
    } else {
      console.log('❌ Senha não foi salva no banco de dados!');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmailConfig();

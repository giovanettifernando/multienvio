/**
 * Script de teste para debugging do reset de senha
 *
 * Execute este script após fazer o reset de senha para verificar
 * se a senha foi salva corretamente no banco de dados.
 *
 * Uso:
 * node test-password-reset-debug.js <email-do-usuario>
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Uso: node test-password-reset-debug.js <email-do-usuario>');
    process.exit(1);
  }

  console.log(`\n🔍 Buscando usuário: ${email}\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      tokenVersion: true,
      passwordUpdatedAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    console.error('❌ Usuário não encontrado');
    process.exit(1);
  }

  console.log('✅ Usuário encontrado:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);
  console.log('  TokenVersion:', user.tokenVersion);
  console.log('  PasswordUpdatedAt:', user.passwordUpdatedAt);
  console.log('  UpdatedAt:', user.updatedAt);
  console.log('\n📋 PasswordHash:');
  console.log('  Primeiros 60 caracteres:', user.passwordHash?.substring(0, 60) + '...');
  console.log('  Comprimento total:', user.passwordHash?.length);
  console.log('  Formato válido bcrypt:', user.passwordHash?.startsWith('$2a$') || user.passwordHash?.startsWith('$2b$'));

  // Teste de comparação
  console.log('\n🧪 Teste de comparação de senha:');
  console.log('Digite a senha que você definiu no reset (pressione Ctrl+C para sair):');

  process.stdin.on('data', async (data) => {
    const password = data.toString().trim();

    if (!password) {
      console.log('❌ Senha vazia');
      return;
    }

    try {
      console.log('\n⏳ Comparando senha...');
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (isValid) {
        console.log('✅ SENHA VÁLIDA! O hash está correto.');
        console.log('   O problema pode estar em outro lugar (cache, sessão, etc)');
      } else {
        console.log('❌ SENHA INVÁLIDA! O hash não corresponde à senha fornecida.');
        console.log('   Isso indica que o hash não foi salvo corretamente.');
      }
    } catch (error) {
      console.error('❌ Erro ao comparar senha:', error.message);
    }

    console.log('\n🧪 Digite outra senha para testar (ou Ctrl+C para sair):');
  });
}

main()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });

/**
 * Script para verificar tokens de reset de senha no banco
 *
 * Uso: node check-reset-tokens.js [email-opcional]
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (email) {
    console.log(`\n🔍 Buscando tokens de reset para: ${email}\n`);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        passwordResetTokens: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      console.error('❌ Usuário não encontrado');
      process.exit(1);
    }

    console.log('✅ Usuário:', user.email);
    console.log('  Token Version:', user.tokenVersion);
    console.log('  Password Updated At:', user.passwordUpdatedAt);
    console.log(`\n📋 Últimos ${user.passwordResetTokens.length} tokens de reset:\n`);

    if (user.passwordResetTokens.length === 0) {
      console.log('  (nenhum token encontrado)');
    } else {
      user.passwordResetTokens.forEach((token, index) => {
        console.log(`  ${index + 1}. Token ID: ${token.id}`);
        console.log(`     Criado em: ${token.createdAt}`);
        console.log(`     Expira em: ${token.expiresAt}`);
        console.log(`     Usado em: ${token.usedAt || 'NÃO USADO'}`);
        console.log(`     Status: ${getTokenStatus(token)}`);
        console.log('');
      });
    }
  } else {
    console.log('\n🔍 Buscando todos os tokens de reset recentes\n');

    const tokens = await prisma.passwordResetToken.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log(`📋 Últimos ${tokens.length} tokens de reset:\n`);

    if (tokens.length === 0) {
      console.log('  (nenhum token encontrado)');
    } else {
      tokens.forEach((token, index) => {
        console.log(`  ${index + 1}. Email: ${token.user.email}`);
        console.log(`     Token ID: ${token.id}`);
        console.log(`     Criado em: ${token.createdAt}`);
        console.log(`     Expira em: ${token.expiresAt}`);
        console.log(`     Usado em: ${token.usedAt || 'NÃO USADO'}`);
        console.log(`     Status: ${getTokenStatus(token)}`);
        console.log('');
      });
    }
  }

  await prisma.$disconnect();
}

function getTokenStatus(token) {
  if (token.usedAt) {
    return '✅ USADO';
  }
  if (new Date() > token.expiresAt) {
    return '⏰ EXPIRADO';
  }
  return '🟢 VÁLIDO';
}

main()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });

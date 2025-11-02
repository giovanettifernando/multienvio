/**
 * Script para testar transações de carteira
 *
 * Uso: node test-wallet-transactions.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('\n🔍 Verificando transações de carteira...\n');

  // Listar todos os usuários com carteira
  const users = await prisma.user.findMany({
    include: {
      wallet: {
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      },
    },
  });

  console.log(`📊 Total de usuários: ${users.length}\n`);

  for (const user of users) {
    if (user.wallet) {
      console.log(`👤 Usuário: ${user.email}`);
      console.log(`   Wallet ID: ${user.wallet.id}`);
      console.log(`   Saldo disponível: R$ ${(user.wallet.availableCents / 100).toFixed(2)}`);
      console.log(`   Saldo pendente: R$ ${(user.wallet.pendingCents / 100).toFixed(2)}`);
      console.log(`   Total de transações: ${user.wallet.transactions.length}`);

      if (user.wallet.transactions.length > 0) {
        console.log('\n   📝 Últimas transações:');
        user.wallet.transactions.forEach((tx, index) => {
          const amount = (tx.amountCents / 100).toFixed(2);
          const sign = tx.amountCents > 0 ? '+' : '';
          console.log(`   ${index + 1}. ${tx.type} - ${sign}R$ ${amount} - ${tx.status} - ${tx.createdAt.toISOString()}`);
          console.log(`      Título: ${tx.title || 'N/A'}`);
          console.log(`      Reference: ${tx.referenceId || 'N/A'}`);
        });
      }
      console.log('');
    } else {
      console.log(`👤 Usuário: ${user.email} (sem carteira)\n`);
    }
  }

  // Listar todas as transações diretamente
  console.log('\n📋 Todas as transações (diretamente):');
  const allTx = await prisma.walletTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      wallet: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (allTx.length === 0) {
    console.log('   (nenhuma transação encontrada)\n');
  } else {
    allTx.forEach((tx, index) => {
      const amount = (tx.amountCents / 100).toFixed(2);
      const sign = tx.amountCents > 0 ? '+' : '';
      console.log(`${index + 1}. ${tx.type} - ${sign}R$ ${amount} - ${tx.status}`);
      console.log(`   WalletID: ${tx.walletId}, UserID: ${tx.wallet.userId}`);
      console.log(`   Criado: ${tx.createdAt.toISOString()}`);
      console.log(`   Título: ${tx.title || 'N/A'}`);
      console.log('');
    });
  }

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });

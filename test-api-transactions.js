/**
 * Teste da API de transações
 *
 * Este script simula uma chamada à API /api/wallet/transactions
 */

const { PrismaClient } = require('@prisma/client');
const { listTransactions } = require('./lib/wallet/wallet.service');

const prisma = new PrismaClient();

async function main() {
  console.log('\n🧪 Testando listTransactions...\n');

  // Buscar um usuário com carteira
  const user = await prisma.user.findFirst({
    where: {
      wallet: {
        isNot: null,
      },
    },
  });

  if (!user) {
    console.log('❌ Nenhum usuário com carteira encontrado');
    return;
  }

  console.log(`✅ Testando com usuário: ${user.email} (ID: ${user.id})\n`);

  // Testar o serviço diretamente
  const transactions = await listTransactions(user.id, { limit: 10 });

  console.log(`📊 Total de transações retornadas: ${transactions.length}\n`);

  if (transactions.length === 0) {
    console.log('⚠️  Nenhuma transação retornada pelo serviço');
  } else {
    transactions.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.type} - ${tx.status}`);
      console.log(`   Valor: R$ ${tx.amountReais.toFixed(2)} (${tx.amountCents} centavos)`);
      console.log(`   Título: ${tx.title || 'N/A'}`);
      console.log(`   Criado: ${new Date(tx.createdAt).toISOString()}`);
      console.log('');
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);

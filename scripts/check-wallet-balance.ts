import { prisma } from '@/platform/db/db';

async function check() {
  const wallet = await prisma.wallet.findUnique({
    where: { userId: 'ccad7a5b-1251-4488-927a-022016095247' },
  });

  console.log('🏦 Wallet:', {
    id: wallet?.id,
    availableCents: wallet?.availableCents,
    pendingCents: wallet?.pendingCents,
    saldoDisponivel: wallet?.availableCents !== null && wallet?.availableCents !== undefined
      ? `R$ ${wallet.availableCents / 100}`
      : 'N/A',
    saldoPendente: wallet?.pendingCents !== null && wallet?.pendingCents !== undefined
      ? `R$ ${wallet.pendingCents / 100}`
      : 'N/A',
  });

  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet?.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`\n📝 Últimas ${transactions.length} transações:`);
  transactions.forEach(tx => {
    const amount = tx.amountCents / 100;
    console.log(`  - ${tx.type}: R$ ${amount.toFixed(2)} (${tx.status}) - ${tx.createdAt.toISOString()}`);
  });

  await prisma.$disconnect();
}

check();
